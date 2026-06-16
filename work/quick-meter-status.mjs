const res = await fetch('https://pmo-agent-khaki.vercel.app/api/meter-status?probe=' + Date.now());
console.log(await res.text());
