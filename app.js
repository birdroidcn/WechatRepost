var http = require('http');
var fs = require('fs');
var connect = require('connect');
var wechat = require('wechat');
var redis = require("redis");//key-value  sys;
var eventproxy = require('eventproxy');
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

var app = connect();
app.use(connect.favicon('public/favicon.ico'));
app.use(connect.query());
app.use(connect.static(__dirname + '/public', { maxAge: 86400000 }));
app.use('/wechat', wechat(config.wxToken, wechat.text(function (message, req, res) {
    var input = (message.Content || '').trim();
    //不是微信链接中止
    if(!WXMsg.isWXUrl(input))
        return res.reply('暂时只支持分享公众账号的文章：在公众账号的文章页面中点右上角菜单，选择“复制链接”，将该链接发送给本账号即可分享到新浪微博');
    //取得用户名称相对应的token
    client.get(message.FromUserName, function (err, reply) {
        if(err) return reply(err);
        if(!reply){
            return res.reply('请先授权您的新浪微博：https://api.weibo.com/oauth2/authorize?client_id='
                + config.appKey
                +'&response_type=code&redirect_uri='+ config.redirect + '/'
                + message.FromUserName);
        }
        var token = reply.toString();
        var proxy = new eventproxy();
        //得到文章和短链后发布微博
        proxy.all("article", "short", function (article, short) {
            if(!article.err && !short.err){
                weibo.publishWeiboWithPic({
                    access_token : token,
                    status : '「'+article.content.title+'」'+article.content.desc+short.content,
                    pic : article.content.pic
                },function(){
                    /*if(result.error){
                        res.reply('粗错了：' + esult.error);
                    } else{
                        res.reply('发布成功！');
                    }*/
                });
                res.reply('发布成功！');
            }else{
                if(article.err) res.reply('粗错了：article'+article.err);
                else res.reply('粗错了：short'+short.err);
            }
            proxy = null;
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
        res.reply('暂时只支持分享公众账号的文章：在公众账号的文章页面中点右上角菜单，选择“复制链接”，将该链接发送给本账号即可分享到新浪微博');
    }).event(function (message, req, res) {
        if (message.Event === 'subscribe') {
            client.get(message.FromUserName, function (err, reply) {
                if(err) return reply(err);
                if(!reply){
                    // 用户添加时候的消息
                    //请求微博授权，成功后返回带有用户ID和相应token的URl
                    res.reply('请先点击该链接https://api.weibo.com/oauth2/authorize?client_id='+ config.appKey
                        +'&response_type=code&redirect_uri='+ config.redirect + '/'
                        + message.FromUserName+
                        '授权您的新浪微博');
                }else{
                    res.reply('欢迎回来！有不满您说哦~');
                }
            });
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
        weibo.getToken({
            appKey : config.appKey,
            appSecret : config.appSecret,
            redirect : config.redirect,
            code : query.code
        },function(error,result){
            var content = ""
            if(!error){
                if(result.access_token){
                    //store user-token in redis
                    client.set(user,result.access_token);
                    client.expire(user, result.expires_in);//设置过期时间
                    content = fs.readFileSync(__dirname + '/public/success.html', 'utf8');
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
        res.end(fs.readFileSync(__dirname + '/public/index.html', 'utf8'));
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
