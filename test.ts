import fetch from 'node-fetch'; // tsx should handle global fetch in node 18+
fetch('https://api.grizzlysms.com/stubs/handler_api.php?api_key=7d61414bc5b058d8e5b19caf5c502366&action=getPrices&country=0')
  .then(res => res.json())
  .then(data => {
     console.log(Object.keys(data['0']).slice(0, 50).map(k => k).join(', '));
  }).catch(console.error);
