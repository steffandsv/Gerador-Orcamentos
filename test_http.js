const fs = require('fs');
fetch('http://localhost:3000')
  .then(res => res.text())
  .then(text => fs.writeFileSync('error_out.txt', text))
  .catch(err => console.error(err));
