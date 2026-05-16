import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

async function testEndpoint() {
  const res = await fetch("http://localhost:3000/api/data-sync", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-api-key": process.env.VITE_API_KEY || "dummy"
    },
    body: JSON.stringify({
      cmd: "get_pincode_records",
      args: { page: 1, limit: 10, search: "", moduleType: "K" }
    })
  });
  console.log(await res.text());
}
testEndpoint();
