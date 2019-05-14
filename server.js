const express = require('express')
const app = express()
const path = require('path');

const port = process.env.PORT;

app.use("/public", express.static(__dirname + "/public"));

app.get('/data', (req, res) => {
    res.send('datalink')
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'visualizer/index.html'));
})


if(port !== undefined){
    app.listen(port, () => console.log(`Example app listening on port ${port}!`))
} else {
    app.listen(3000, () => console.log(`Example app listening on port ${3000}!`))
}