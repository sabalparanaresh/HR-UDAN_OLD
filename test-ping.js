async function ping() {
    try {
        const res = await fetch("http://localhost:3000/api/ping", { method: 'POST' });
        console.log("STATUS:", res.status);
        console.log("BODY:", await res.text());
        process.exit(0);
    } catch(err) {
        console.error("FETCH ERROR:", err);
        process.exit(1);
    }
}
ping();
