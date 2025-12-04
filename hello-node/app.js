// app.js
const express = require('express'); // if package.json has "type":"module"
 // or: const express = require('express');  // if CommonJS

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

app.listen(PORT, () => {
  console.log(`Express server listening at http://localhost:${PORT}`);
});
