const https = require('https');
const fs = require('fs');

https.get('https://www.ambq.gov.co/transporte/transporte-publico-colectivo/', res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    // Extract a PDF link
    const match = body.match(/href=\"([^\"]+\.pdf)\"/i);
    if(match) {
      console.log("Found PDF:", match[1]);
      const file = fs.createWriteStream('sample.pdf');
      https.get(match[1], res2 => {
        res2.pipe(file);
        res2.on('end', () => console.log('Downloaded successful.'));
      });
    } else {
      console.log('No PDF found directly on the page. Trying to scrape one of the accordions...');
      // The accordions listed things like A7-4112 pointing to the same URL
    }
  });
});
