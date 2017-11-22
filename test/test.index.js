/**
 * mocha 测试 文件
 * @author ydr.me
 * @create 2016-05-17 12:13
 */


'use strict';

var expect = require('chai').expect;
var weixin = require('../src/index.js');


describe('测试文件', function () {
    it('base', function (done) {
        var url = 'https://ydr.me/';

        weixin.config({
            debug: true,
            appId: 'wxa8c289037620b15c',
            appSecret: '397c03bae013c5ade076009c973edf2e'
        });

        weixin.jsApiSignature(url, function (err, sign) {
            if (err) {
                return done(err);
            }

            console.log(sign);
            done();
        });
    });

    it('mutiple instance', function (done) {
        var url = 'https://ydr.me/';

        weixin.config({
            debug: true,
            appId: 'a',
            appSecret: 'b'
        });

        weixin.jsApiSignature({
            appId: 'wxa8c289037620b15c',
            appSecret: '397c03bae013c5ade076009c973edf2e'
        }, url, function (err, sign) {
            if (err) {
                return done(err);
            }

            console.log(sign);
            done();
        });
    });
});

