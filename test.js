const fetch = require('node-fetch');

(async () => {
    let res = await fetch("https://api.grizzlysms.com/stubs/handler_api.php?api_key=7d61414bc5b058d8e5b19caf5c502366&action=getServices");
    console.log(await res.text());
})();
