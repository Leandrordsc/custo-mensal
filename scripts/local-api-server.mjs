import { createServer } from "node:http";
import { CardService } from "../lib/card-service.ts";
import { SQLiteDashboardRepository } from "../lib/dashboard-repository.ts";
import { ExpenseService } from "../lib/expense-service.ts";
import { InvestmentService } from "../lib/investment-service.ts";
import { getLocalAuthenticatedUser } from "../lib/local-auth.ts";
import { getLocalDatabasePath, openLocalDatabase } from "../lib/local-db.ts";

export function createLocalApiHandler({ db, context = getLocalAuthenticatedUser() }) {
  const service = new ExpenseService(db);
  const cardService = new CardService(db);
  const investmentService = new InvestmentService(db);
  const dashboardRepository = new SQLiteDashboardRepository(db, investmentService);

  return async function handle(request) {
    try {
      if (request.method === "OPTIONS") {
        return jsonResponse({}, 204);
      }

      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === "GET" && path === "/api/health") {
        return jsonResponse({ ok: true, userId: context.userId });
      }
      if (request.method === "GET" && path === "/api/dashboard") {
        return jsonResponse(dashboardRepository.getDashboardOverview(context, parseDashboardPeriod(url)));
      }
      if (request.method === "GET" && path === "/api/cards/overview") {
        return jsonResponse(cardService.getOverview(context, parseDashboardPeriod(url)));
      }
      if (request.method === "GET" && path === "/api/investments/overview") {
        return jsonResponse(investmentService.getOverview(context, parseDashboardPeriod(url)));
      }
      if (request.method === "GET" && path === "/api/investments/bases") {
        return jsonResponse(investmentService.listBases(context));
      }
      if (request.method === "GET" && path === "/api/costs/bases") {
        return jsonResponse(service.listBases(context));
      }
      if (request.method === "GET" && path === "/api/costs/expenses") {
        return jsonResponse(service.listExpenses(context, parsePeriod(url)));
      }
      if (request.method === "GET" && path === "/api/costs/summary") {
        return jsonResponse(service.summarize(context, parsePeriod(url)));
      }

      const expenseMatch = path.match(/^\/api\/costs\/expenses\/([^/]+)$/);
      if (expenseMatch && request.method === "GET") {
        return jsonResponse(service.getExpense(context, decodeURIComponent(expenseMatch[1])));
      }
      if (path === "/api/costs/expenses" && request.method === "POST") {
        const body = await readBody(request);
        rejectUserId(body);
        return jsonResponse(service.createExpense(context, body), 201);
      }
      if (path === "/api/investments/operations" && request.method === "POST") {
        const body = await readBody(request);
        rejectUserId(body);
        return jsonResponse(investmentService.createInvestmentOperation(context, body), 201);
      }
      if (path === "/api/investments/prices" && request.method === "POST") {
        const body = await readBody(request);
        rejectUserId(body);
        return jsonResponse(investmentService.createAssetPrice(context, body), 201);
      }
      if (path === "/api/investments/exchange-rates" && request.method === "POST") {
        const body = await readBody(request);
        rejectUserId(body);
        return jsonResponse(investmentService.createExchangeRate(context, body), 201);
      }
      if (expenseMatch && request.method === "PUT") {
        const body = await readBody(request);
        rejectUserId(body);
        return jsonResponse(service.updateExpense(context, decodeURIComponent(expenseMatch[1]), body));
      }

      const cancelMatch = path.match(/^\/api\/costs\/expenses\/([^/]+)\/cancel$/);
      if (cancelMatch && request.method === "POST") {
        const body = await readBody(request);
        rejectUserId(body);
        return jsonResponse(service.cancelExpense(context, decodeURIComponent(cancelMatch[1])));
      }

      return jsonResponse({ error: "Rota nao encontrada." }, 404);
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Erro inesperado." }, 400);
    }
  };
}

function parseDashboardPeriod(url) {
  const year = Number(url.searchParams.get("year"));
  const monthValue = url.searchParams.get("month") ?? "all";
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    throw new Error("Ano invalido.");
  }
  if (monthValue === "all") {
    return { fromMonth: `${year}-01`, toMonth: `${year}-12` };
  }
  const month = Number(monthValue);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Mes invalido.");
  }
  const canonicalMonth = `${year}-${String(month).padStart(2, "0")}`;
  return { fromMonth: canonicalMonth, toMonth: canonicalMonth };
}

function parsePeriod(url) {
  const year = Number(url.searchParams.get("year"));
  const monthValue = url.searchParams.get("month");
  const month = monthValue ? Number(monthValue) : null;
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    throw new Error("Ano invalido.");
  }
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    throw new Error("Mes invalido.");
  }
  return { year, month };
}

async function readBody(request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

function rejectUserId(body) {
  if (body && typeof body === "object" && ("user_id" in body || "userId" in body)) {
    throw new Error("user_id nao pode ser informado pelo cliente.");
  }
}

function jsonResponse(body, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
      "access-control-allow-headers": "content-type",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const db = openLocalDatabase(getLocalDatabasePath());
  const handler = createLocalApiHandler({ db });
  const port = Number(process.env.LOCAL_API_PORT ?? 3001);

  createServer(async (req, res) => {
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
      duplex: "half",
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
  }).listen(port, "127.0.0.1", () => {
    console.log(`API local em http://127.0.0.1:${port}`);
  });
}
