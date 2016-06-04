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
        var url = 'http://ydr.me/';

        weixin.config({
            appId: 'wx96a5681296a37413',
            secret: 'ef20.....bf1d192'
        });

        weixin.JSSDKSignature(url, function (err, sign) {
            console.log(err);
            console.log(sign);
            done();
        });
    });
});

