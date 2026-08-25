const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const SERPAPI_KEY = process.env.SERPAPI_KEY;

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function searchDeals(query, location) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      engine: "google_shopping",
      q: query,
      location: location || "Asheville, North Carolina, United States",
      gl: "us",
      hl: "en",
      api_key: SERPAPI_KEY
    });

    const url = `https://serpapi.com/search.json?${params.toString()}`;

    https.get(url, (response) => {
      let data = "";

      response.on("data", chunk => data += chunk);

      response.on("end", () => {
        try {
          const json = JSON.parse(data);

          if (json.error) {
            reject(new Error(json.error));
            return;
          }

          const items = (json.shopping_results || []).slice(0, 10).map((item, index) => ({
            rank: index + 1,
            title: item.title || "Product",
            price: item.extracted_price || null,
            priceText: item.price || "",
            oldPrice: item.extracted_old_price || null,
            oldPriceText: item.old_price || "",
            store: item.source || item.seller || "Store",
            rating: item.rating || null,
            reviews: item.reviews || null,
            image: item.thumbnail || "",
            delivery: item.delivery || "",
            link: item.product_link || item.link || ""
          }));

          resolve(items);
        } catch (err) {
          reject(err);
        }
      });
    }).on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === "/api/search") {
    if (!SERPAPI_KEY) {
      return sendJson(res, 500, {
        error: "SerpApi key has not been configured yet."
      });
    }

    const query = requestUrl.searchParams.get("q");
    const location = requestUrl.searchParams.get("location");

    if (!query) {
      return sendJson(res, 400, { error: "Please enter an item to search for." });
    }

    try {
      const results = await searchDeals(query, location);
      return sendJson(res, 200, { results });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  let filePath = requestUrl.pathname === "/"
    ? path.join(__dirname, "public", "index.html")
    : path.join(__dirname, "public", requestUrl.pathname);

  const publicDir = path.join(__dirname, "public");
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(normalized, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }

    const ext = path.extname(normalized);
    const types = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript"
    };

    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream"
    });

    res.end(content);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Deal Hunter is running on port ${PORT}`);
});
