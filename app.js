var http = require('http');
var connect = require('connect');
var wechat = require('wechat');
var redis = require("redis");//key-value  sys;
var request = require('request');
var config = require('./lib/config.js');
//appFog 启动命令
if(process.env.VCAP_SERVICES){
    var env = JSON.parse(process.env.VCAP_SERVICES);
    var redisArgs = env['redis-2.2'][0]['credentials'];
    var client = redis.createClient(redisArgs.port,redisArgs.host);
    client.auth(redisArgs.password);
}else{
    var client = redis.createClient(3770,'127.0.0.1');
}

client.on("error", function (err) {
    console.log("Error " + err);
});

var app = connect();
app.use(connect.query());
app.use(connect.static(__dirname + '/assets', { maxAge: 86400000 }));
app.use('/wechat', wechat(config.wxToken, wechat.text(function (message, req, res) {
    var input = (message.Content || '').trim();
    //取得用户名称相对应的token
    client.get(message.FromUserName, function (err, reply) {
        var token = reply.toString();
        if(token == ''){
            return res.reply('请先授权：https://api.weibo.com/oauth2/authorize?client_id='
                            + config.appKey
                            +'&response_type=code&redirect_uri='+ config.redirect + '/'
                            + message.FromUserName);
        }
        //通过开放平台发布微博
        request({
            uri: 'https://api.weibo.com/2/statuses/update.json',
            method : 'POST',
            qs : {
                access_token : token,
                status : encodeURIComponent(input)
            }
        },function(error,response,body){
            var content = '';
            var result = JSON.parse(body);
            content = result.error || '发布成功！';
            res.reply(content);
        });

    });

    }).image(function (message, req, res) {
        console.log(message);
    }).event(function (message, req, res) {
        if (message.Event === 'subscribe') {
            // 用户添加时候的消息
            //请求微博授权，成功后返回带有用户ID和相应token的URl
            res.reply('点击https://api.weibo.com/oauth2/authorize?client_id='+ config.appKey
                     +'&response_type=code&redirect_uri='+ config.redirect + '/'
                     + message.FromUserName+
                     '授权');
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
        //get access_token
        request({
            uri: 'https://api.weibo.com/oauth2/access_token',
            method : 'POST',
           qs : {
               client_id : config.appKey,
               client_secret : config.appSecret,
               grant_type : "authorization_code",
               redirect_uri : config.redirect,
               code : query.code
           }
        },function(error,response,body){
            var content = ""
            if(!error){
                var result = JSON.parse(body);
                if(result.access_token){
                    //store user-token in redis
                    client.set(user,result.access_token);
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
        res.end('<head><meta property="wb:webmaster" content="43ff0390664d778e" />'
               +'<title>wechat公共账号分享</title></head><body>欢迎登陆</body>');
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
