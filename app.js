var http = require('http');
var connect = require('connect');
var wechat = require('wechat');
var redis = require("redis");//key-value  sys;
var request = require('request');
var proxy =new require('eventproxy')();
var config = require('./lib/config.js');
var WXMsg = require('./lib/WXMsg');
var weibo = require('./lib/weibo');
//appFog 启动redis
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
//var input = 'http://mp.weixin.qq.com/mp/appmsg/show?__biz=MjM5NjA4MTAyMA==&appmsgid=10000385&itemidx=1';

var app = connect();
app.use(connect.favicon('public/favicon.ico'));
app.use(connect.query());
app.use(connect.static(__dirname + '/assets', { maxAge: 86400000 }));
app.use('/wechat', wechat(config.wxToken, wechat.text(function (message, req, res) {
    var input = (message.Content || '').trim();
    //不是微信链接中止
    if(WXMsg.isWXUrl(input))
        return res.reply('暂时只支持分享公共账号的文章：在公共账号的文章选择“复制链接”，然后将该链接发送给本账号');
    //取得用户名称相对应的token
    client.get(message.FromUserName, function (err, reply) {
        var token = reply.toString();
        if(token == ''){
            return res.reply('请先授权：https://api.weibo.com/oauth2/authorize?client_id='
                + config.appKey
                +'&response_type=code&redirect_uri='+ config.redirect + '/'
                + message.FromUserName);
        }
        //得到文章和短链后发布微博
        proxy.all("article", "short", function (article, short) {
            if(!article.err && !short.err){
                weibo.publishWeibo({
                    access_token : token,
                    status : article.content.title+':'+article.content.desc+short.content,
                    pic : article.content.pic
                },function(error,response,body){
                    var result = JSON.parse(body);
                    if(result.error){
                        res.reply('粗错了：' + esult.error);
                    } else{
                        res.reply('发布成功！');
                    }
                });
            }else{
                if(article.err) res.reply('粗错了：article'+article.err);
                else res.reply('粗错了：short'+short.err);
            }
        });
        //请求微信文章并解析
        WXMsg.getMsg(input,function(err,article){
            proxy.emit("article", {err:err,content:article});
        });
        //得到短链
        weibo.getShorten({
            access_token : token,
            url : input
        },function(err,short){
            proxy.emit("short", {err:err,content:short});
        });
    });

    }).image(function (message, req, res) {
        res.reply('暂时只支持分享公共账号的文章：在公共账号的文章选择“复制链接”，然后将该链接发送给本账号');
    }).event(function (message, req, res) {
        if (message.Event === 'subscribe') {
            // 用户添加时候的消息
            //请求微博授权，成功后返回带有用户ID和相应token的URl
            res.reply('点击https://api.weibo.com/oauth2/authorize?client_id='+ config.appKey
                     +'&response_type=code&redirect_uri='+ config.redirect + '/'
                     + message.FromUserName+
                     '授权');
        } else if (message.Event === 'unsubscribe') {
            console.log('leave');
        } else {
            console.log('unknown');
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
                    content = '<head><meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" name="viewport" />'
                    +'<meta http-equiv="content-type" content="text/html;charset=utf-8" />'
                    +'<title>wechat公共账号分享</title></head><body><p style="margin: 50 auto;width: 300px;">授权成功！现在您可以使用分享功能！</p></body>';
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
               +'<meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" name="viewport" />'
               +'<meta http-equiv="content-type" content="text/html;charset=utf-8" />'
               +'<title>wechat公共账号分享</title></head><body><p style="margin: 50 auto;width: 300px;">关注微信公共账号「公共账号分享」可以分享公共账号或者其他微信文章到新浪微博</p></body>');
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
