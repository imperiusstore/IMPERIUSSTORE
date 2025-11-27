import fs from 'fs';
import path from 'path';
import readline from 'readline';
import https from 'https';
import { URLSearchParams } from 'url';

interface CardData {
  number: string;
  expMonth: number;
  expYear: number;
  cvc?: string;
  masked: string;
  lineNumber: number;
}

interface CardCheckResult {
  ok: boolean;
  tokenId?: string;
  statusCode: number;
  message?: string;
  code?: string;
  lineNumber: number;
  masked: string;
}

interface CliOptions {
  filePath: string;
  concurrency: number;
  delayMs: number;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let filePath = 'cards.txt';
  let concurrency = 5;
  let delayMs = 0;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--file':
      case '-f':
        filePath = args[i + 1] ?? filePath;
        i++;
        break;
      case '--concurrency':
      case '-c':
        concurrency = Number(args[i + 1] ?? concurrency) || concurrency;
        i++;
        break;
      case '--delay':
      case '-d':
        delayMs = Number(args[i + 1] ?? delayMs) || delayMs;
        i++;
        break;
      default:
        if (!arg.startsWith('-') && filePath === 'cards.txt') {
          filePath = arg;
        }
    }
  }

  return { filePath, concurrency, delayMs };
}

function normalizeYear(year: number): number {
  if (year < 100) {
    return 2000 + year;
  }

  return year;
}

function maskCardNumber(cardNumber: string): string {
  const trimmed = cardNumber.replace(/\s+/g, '');
  const visible = trimmed.slice(-4);
  const hidden = trimmed.slice(0, -4).replace(/\d/g, '•');
  return `${hidden}${visible}`;
}

function parseCardLine(line: string, lineNumber: number): CardData | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const parts = trimmed.split(/[|,;\s]+/).filter(Boolean);

  if (parts.length < 3) {
    console.warn(`⚠️  Linha ${lineNumber}: formato inválido (mínimo esperado: número, mês, ano [, cvc])`);
    return null;
  }

  const [number, monthString, yearString, cvc] = parts;
  const expMonth = Number(monthString);
  const expYear = normalizeYear(Number(yearString));

  if (!number || Number.isNaN(expMonth) || Number.isNaN(expYear)) {
    console.warn(`⚠️  Linha ${lineNumber}: não foi possível interpretar os campos`);
    return null;
  }

  return {
    number,
    expMonth,
    expYear,
    cvc,
    masked: maskCardNumber(number),
    lineNumber,
  };
}

async function loadCards(filePath: string): Promise<CardData[]> {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo com cartões não encontrado: ${resolvedPath}`);
  }

  const fileStream = fs.createReadStream(resolvedPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const cards: CardData[] = [];
  for await (const line of rl) {
    const card = parseCardLine(line, cards.length + 1);
    if (card) {
      cards.push(card);
    }
  }

  return cards;
}

async function createStripeToken(
  secretKey: string,
  card: CardData,
): Promise<CardCheckResult> {
  const body = new URLSearchParams();
  body.append('card[number]', card.number);
  body.append('card[exp_month]', card.expMonth.toString());
  body.append('card[exp_year]', card.expYear.toString());

  if (card.cvc) {
    body.append('card[cvc]', card.cvc);
  }

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: 'api.stripe.com',
        path: '/v1/tokens',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body.toString()),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');

          try {
            const parsed = rawBody ? JSON.parse(rawBody) : {};

            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              resolve({
                ok: true,
                tokenId: parsed.id,
                statusCode: response.statusCode,
                lineNumber: card.lineNumber,
                masked: card.masked,
              });
            } else {
              resolve({
                ok: false,
                statusCode: response.statusCode ?? 0,
                message: parsed.error?.message ?? 'Erro desconhecido',
                code: parsed.error?.code,
                lineNumber: card.lineNumber,
                masked: card.masked,
              });
            }
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on('error', reject);
    request.write(body.toString());
    request.end();
  });
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processCards(
  secretKey: string,
  cards: CardData[],
  concurrency: number,
  delayMs: number,
): Promise<void> {
  let cursor = 0;
  let okCount = 0;
  let failCount = 0;
  const start = Date.now();

  async function worker(workerId: number): Promise<void> {
    while (true) {
      const index = cursor++;
      const card = cards[index];

      if (!card) {
        break;
      }

      console.log(`🔍 [${workerId}] Testando cartão ${card.masked} (linha ${card.lineNumber})...`);

      try {
        const result = await createStripeToken(secretKey, card);

        if (result.ok) {
          okCount += 1;
          console.log(`✅  [${workerId}] Aprovado: token ${result.tokenId} (linha ${result.lineNumber})`);
        } else {
          failCount += 1;
          const codeInfo = result.code ? ` [${result.code}]` : '';
          console.log(
            `❌  [${workerId}] Recusado${codeInfo}: ${result.message ?? 'motivo desconhecido'} (linha ${result.lineNumber})`,
          );
        }
      } catch (error: any) {
        failCount += 1;
        console.error(`❌  [${workerId}] Falha inesperada (linha ${card.lineNumber}):`, error.message ?? error);
      }

      if (delayMs > 0) {
        await delay(delayMs);
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }).map((_, index) =>
    worker(index + 1),
  );

  await Promise.all(workers);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('\n📊 Resumo:');
  console.log(`   Total processado: ${cards.length}`);
  console.log(`   Aprovados: ${okCount}`);
  console.log(`   Recusados: ${failCount}`);
  console.log(`   Tempo: ${elapsed}s`);
}

async function main(): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    console.error('❌ STRIPE_SECRET_KEY não encontrada nas variáveis de ambiente.');
    process.exit(1);
  }

  const { filePath, concurrency, delayMs } = parseArgs();

  console.log('🚀 Iniciando checker de cartões Stripe');
  console.log(`   Arquivo: ${path.resolve(filePath)}`);
  console.log(`   Concorrência: ${concurrency}`);
  console.log(`   Intervalo entre requisições: ${delayMs}ms`);

  const cards = await loadCards(filePath);

  if (cards.length === 0) {
    console.log('⚠️  Nenhum cartão válido encontrado.');
    return;
  }

  await processCards(secretKey, cards, concurrency, delayMs);
}

main().catch((error) => {
  console.error('❌ Erro geral ao executar o checker:', error);
  process.exit(1);
});
