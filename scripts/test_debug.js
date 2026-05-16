import fetch from "node-fetch";

async function testEndpoint() {
  const res = await fetch("http://localhost:3000/api/data-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd: "debug_commands", args: {} })
  });
  console.log(await res.text());
}
testEndpoint();
