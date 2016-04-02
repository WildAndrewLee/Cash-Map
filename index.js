var express = require('express');
var handlebars = require('express-handlebars');

const PORT = 5675;

var app = express();
app.enable('trust proxy');
app.use(express.static(__dirname + '/static'));
app.engine('html', handlebars());
app.set('view engine', 'html');
app.set('views', __dirname + '/templates');

app.get('/', (req, resp) => {
    resp.render('index');
});

app.listen(PORT);
