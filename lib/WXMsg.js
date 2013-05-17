var request = require('request');
var URL = require('url');

function isEmptyObj(obj){
    for(var i in obj){
        if(obj.hasOwnProperty(i)){
            return false;
        }
    }
    return true;
}
/**
 * @overview 请求微信文章并解析出标题概述
 * @param url
 * @param callback
 */
exports.getMsg = function(url,callback){
    url = url.trim();
    request.get({uri: url},function(error,response,body){
        if(error) return callback(error);
        var re = null,
            msg = {},
            patt = /<script\s+id=\"txt-(.+)\"\s+type=\"txt\/text\"\s*>(.+?)<\/script>/g;
        while ( (re = patt.exec(body) )!= null ){
            msg[re[1]] = re[2];
        }
        if(isEmptyObj(msg)){
           callback('链接地址不正确或者文章不存在，请再试~');
        }else{
            msg.pic = body.match(/<img\s+src=\"(.+?)\"/)[1];
            callback(null,msg);
        }
    });

};

exports.isWXUrl = function(url){
   var url = URL.parse(url);
   url.host == 'mp.weixin.qq.com' ? true : false;
};