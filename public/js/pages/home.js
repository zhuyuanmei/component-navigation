/**
 * 移动官网
 * @since 2016.05.09
 */
define(function (require, exports, module) {
    //'导航内部滑动'模块
    if($('#J_Navigation').length){
        require('iscroll');

        var navigation = require('navigation');

        $.navigation({
            //导航元素对象
            navListObj: $('#J_NavList')
        });
    }
});