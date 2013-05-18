var request = require('request');
var FormData = require('form-data');
/**
 * @overview 得到access_token
 * @param params
 * @param cb
 */
exports.getToken = function(params,cb){
    request({
        uri: 'https://api.weibo.com/oauth2/access_token',
        method : 'POST',
        qs : {
            client_id : params.appKey,
            client_secret : params.appSecret,
            grant_type : "authorization_code",
            redirect_uri : params.redirect,
            code : params.code
        }
    },function(err,response,body){
        err?cb(err,null):cb(null,JSON.parse(body));
    });

};
/**
 * @overview 发布不带图的微博
 * @param params
 * @param cb
 */
exports.publishWeibo = function(params,cb){
    request.post({
        uri: 'https://api.weibo.com/2/statuses/update.json',
        form  : {
            access_token : params.access_token,
            status : params.status
        }
    },function(err,res,body){
        err?cb(err,null):cb(null,JSON.parse(body));
    });

};
/**
 * 发布带图微博
 * @param params
 * @param cb
 */
exports.publishWeiboWithPic = function(params,cb){
    var form = new FormData();
    form.append('access_token', params.access_token);
    form.append('status', params.status);
    form.append('pic', request(params.pic));
    form.submit('https://upload.api.weibo.com/2/statuses/upload.json', cb);
};
/**
 * @overview 长链换短链
 * @param params
 * @param cb
 */
exports.getShorten = function(params,cb){
    request.get({
        uri: 'https://api.weibo.com/2/short_url/shorten.json',
        qs  : {
            access_token : params.access_token,
            url_long : params.url
        }
    },function(error,response,body){
        var result = JSON.parse(body);
        result.error ? cb(result.error) : cb(null,result.urls[0].url_short);
    });
};