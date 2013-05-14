var http = require("http");
var https = require("https");
var connect = require("connect");
var wechat = require("wechat");
var redis = require("redis");//key-value
var request = require('request');
var app = connect();

app.use(connect.query());
app.use(connect.static(__dirname + '/assets', { maxAge: 86400000 }));
app.use(connect.cookieParser());
app.use('/wechat', wechat("", wechat.text(function (message, req, res) {
    var input = (message.Content || '').trim();
    var token = redis.get(message.FromUserName);
    if(token == ''){
        return res.reply("请先授权：url");
    }
    https.request({host : "api.weibo.com",
                  method : "POST",
                  path:"/2/statuses/update.json?access_token="+token+"&status="+
                        encodeURIComponent(input)},
                  function(response){
                       var content = '';
                       if(response.statusCode == 200){
                           var result = JSON.parse(response.body);
                           content = result.error || '发布成功！';
                       }else{
                           content = '网络故障，请稍后再试！';
                       }
                      res.reply(content);
                  });

    }).image(function (message, req, res) {
        console.log(message);
    }).event(function (message, req, res) {
        console.log(message);
        if (message.Event === 'subscribe') {
            // 用户添加时候的消息
            //请求微博授权，成功后返回带有用户ID和相应token的URl
            //存储到key-value系统中
            res.reply('点http://open.weibo.com/'+ message.FromUserName+ '授权注册?');
        } else if (message.Event === 'unsubscribe') {
            res.reply('Bye!');
        } else {
            res.reply('暂未支持! Coming soon!');
        }
    })));

app.use('/', function (req, res) {
    var path = req._parsedUrl.pathname.split('/');
    var query = req.query;
    if(path.length==2 && query.code){
        var user = path[1];

        request({
            uri: 'https://api.weibo.com/oauth2/access_token',
            method : 'POST'
        },function(error,response,body){
            var content = ""
            if(!error){
                var result = JSON.parse(body);
                if(result.access_token){
                    redis.set(user,result.access_token);
                    content = "授权成功！";
                }else{
                    content = result.error;
                }
            }else{
                content = error;
            }
            res.writeHead(200);
            res.end(content);
        });

    }else{
        res.writeHead(200);
        res.end('hello wechat');
    }

});

/**
 * Error handler
 */
app.use(function (err, req, res) {
    console.log(err.message);
    console.log(err.stack);
    res.statusCode = err.status || 500;
    res.end(err.message);
});

var server = http.createServer(app).listen(80);

process.on('uncaughtException', function (err) {
    console.error(' Caught exception: ' + err.stack);
});
