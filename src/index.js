/**
 * weixin
 * @doc http://mp.weixin.qq.com/wiki/17/c0f37d5704f0b64713d5d2c37b468d75.html
 * @author ydr.me
 * @create 2015-12-08 11:08
 */


'use strict';

var howdo = require('blear.utils.howdo');
var object = require('blear.utils.object');
var random = require('blear.utils.random');
var number = require('blear.utils.number');
var fun = require('blear.utils.function');
var encryption = require('blear.node.encryption');
var request = require('blear.node.request');


var reHash = /#.*$/;
var WEIXIN_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
var WEIXIN_TICKET_URL = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket';
var WEIXIN_ACCESS_TOKEN_URL = 'https://api.weixin.qq.com/sns/oauth2/access_token';
var WEIXIN_USER_INFO = 'https://api.weixin.qq.com/sns/userinfo';
var configs = {
    debug: false,
    appId: '',
    secret: '',
    // 指定 令牌
    jsApiTicket: ''
};

exports.config = function (cf) {
    object.assign(configs, cf);
};


/**
 * 解析微信返回内容
 * @param callback
 */
var parseWeixinBody = function (callback) {
    callback = fun.noop(callback);

    return function (err, body) {
        if (err) {
            return callback(err);
        }

        var ret = {};

        try {
            ret = JSON.parse(body);
            ret.errcode = ret.errcode || 0;
        } catch (err) {
            ret.errcode = -1;
            ret.errmsg = '数据解析失败';
        }

        if (ret.errcode !== 0) {
            return callback(new TypeError(ret.errmsg || '未知错误'));
        }

        if (ret.expires_in) {
            ret.expires_in = ret.expires_in * 1000;
            ret.expiresIn = ret.expires_in;
        }

        if (ret.access_token) {
            ret.accessToken = ret.access_token;
        }

        if (ret.refresh_token) {
            ret.refreshToken = ret.refresh_token;
        }

        if (ret.openid) {
            ret.openId = ret.openid;
        }

        if (ret.unionid) {
            ret.unionId = ret.unionid;
        }

        if (ret.headimgurl) {
            ret.avatar = ret.headimgurl;
        }

        callback(null, ret);
    };
};


// 获取微信 JSSDK token
var getJSSDKToken = function (callback) {
    request({
        url: WEIXIN_TOKEN_URL,
        query: {
            grant_type: 'client_credential',
            appid: configs.appId,
            secret: configs.secret
        },
        debug: configs.debug
    }, parseWeixinBody(callback));
};


// 获取微信 JSSDK jsapi_ticket
var getJSSDKApiTicket = function (callback) {
    if (configs.jsApiTicket) {
        return callback(null, {
            ticket: configs.jsApiTicket,
            expiresIn: -1
        });
    }

    howdo
        .task(getJSSDKToken)
        .task(function (next, ret) {
            request({
                url: WEIXIN_TICKET_URL,
                query: {
                    access_token: ret.accessToken,
                    type: 'jsapi'
                },
                debug: configs.debug
            }, parseWeixinBody(next));
        })
        .follow(callback);
};


/**
 * 签名算法
 * @param info {String} 用于签名的 jsapi_ticket
 * @param url {String} 用于签名的 url ，注意必须动态获取，不能 hardcode
 * @returns {Object}
 */
var signature = function (info, url) {
    var ret = {
        jsapi_ticket: info.ticket,
        nonceStr: random.string(),
        timestamp: number.parseInt(Date.now() / 1000),
        url: url.replace(reHash, '')
    };
    var keys = Object.keys(ret);

    keys = keys.sort();

    var list = [];

    keys.forEach(function (key) {
        list.push(key.toLowerCase() + '=' + ret[key]);
    });

    var str = list.join('&');
    var signature = encryption.sha1(str);

    return object.assign(ret, configs, {
        jsApiTicket: info.ticket,
        signature: signature,
        state: random.string(),
        expiresIn: info.expiresIn
    });
};


/**
 * URL 微信 JSSDK 签名
 * @param url
 * @param callback
 */
exports.JSSDKSignature = function (url, callback) {
    getJSSDKApiTicket(function (err, info) {
        if (err) {
            return callback(err);
        }

        callback(null, signature(info, url));
    });
};


/**
 * 根据 code 获取 accessToken
 * @param code
 * @param callback
 */
exports.getAccessToken = function (code, callback) {
    request({
        url: WEIXIN_ACCESS_TOKEN_URL,
        query: {
            appid: configs.appId,
            secret: configs.secret,
            code: code,
            grant_type: 'authorization_code'
        },
        debug: configs.debug
    }, parseWeixinBody(callback));
};


/**
 * 获取用户基本信息
 * @param openId
 * @param accessToken
 * @param callback
 */
exports.getUserInfo = function (openId, accessToken, callback) {
    request({
        url: WEIXIN_USER_INFO,
        query: {
            access_token: accessToken,
            openid: openId,
            lang: 'zh_CN'
        },
        debug: configs.debug
    }, parseWeixinBody(callback));
};

