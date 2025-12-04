const http = require('http');

const PORT = 3000;

const server = http.createServer((req, res) => {
    if (req.url === "/") {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('This is the Home Page');
    } else if (req.url === "/about") {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('This is the About Page');
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Page Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
