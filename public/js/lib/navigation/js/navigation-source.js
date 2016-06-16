/**
 * 导航内部滑动模块
 * @author zym
 * @version 1.0
 * @since 2016-05-09
 */
define(function(require, exports, module) {
    var Mustache = require('mustache');

    // 生成匹配namespace正则
    function matcherFor( ns ) {
        return new RegExp( '(?:^| )' + ns.replace( ' ', ' .* ?' ) + '(?: |$)' );
    }

    // 分离event name和event namespace
    function parse( name ) {
        var parts = ('' + name).split( '.' );

        return {
            e: parts[ 0 ],
            ns: parts.slice( 1 ).sort().join( ' ' )
        };
    }

    function findHandlers( arr, name, callback, context ) {
        var matcher,
            obj;

        obj = parse( name );
        obj.ns && (matcher = matcherFor( obj.ns ));
        return arr.filter(function( handler ) {
            return handler &&
                (!obj.e || handler.e === obj.e) &&
                (!obj.ns || matcher.test( handler.ns )) &&
                (!callback || handler.cb === callback ||
                    handler.cb._cb === callback) &&
                (!context || handler.ctx === context);
        });
    }

    function Event( type, props ) {
        if ( !(this instanceof Event) ) {
            return new Event( type, props );
        }

        props && $.extend( this, props );
        this.type = type;

        return this;
    }

    var errorTip = function($target,tip){
        $target.show();
        $target.text(tip);

        setTimeout(function(){
            $target.removeClass('error-tip');
            $target.addClass('error-tip-fade');

            setTimeout(function(){
                $target.removeClass('error-tip-fade');
                $target.addClass('error-tip');

                $target.hide();
            },500);
        },2000);
    };

    var Navigation = function(options) {
        this.settings = $.extend({}, Navigation.defaults, options);
        this.init();
    };

    Navigation.prototype = {
            /**
             * 初始化
             */
            init : function(){
                this._create();
            },

            /**
             * 创建
             */
            _create: function() {
                var _this = this,
                    opts = _this.settings,
                    $el = opts.navListObj,
                    $list = $el.find( 'ul' ).first(),
                    name = 'ui-navigator',
                    renderer,
                    html;

                _this.prevIndex;

                // 如果没有包含ul节点，则说明通过指定content来create
                // 建议把create模式给拆出去。很多时候都是先写好在dom中了。
                if ( !$list.length && opts.content ){
                    $list = $( _this.tpl2html( 'list' ));
                    renderer = _this.tpl2html( 'item' );

                    html = '';
                    opts.content.forEach(function( item ) {

                        // 如果不提供默认值，然后同时某些key没有传值，parseTpl会报错
                        item = $.extend( {
                            href: '',
                            text: ''
                        }, typeof item === 'string' ? {
                            text: item
                        } : item );

                        html += renderer( item );
                    });

                    $list.append( html ).appendTo( $el );
                }else{
                    // 处理直接通过ul初始化的情况
                    if ($el.is( 'ul, ol' )) {
                        $list = $el.wrap('<div>');
                        $el = $el.parent();
                    }

                    if ( opts.index === undefined ) {
                        // 如果opts中没有指定index, 则尝试从dom中查看是否有比较为ui-state-active的
                        opts.index = $list.find( '.ui-state-active' ).index();

                        // 没找到还是赋值为0
                        ~opts.index || (opts.index = 0);
                    }
                }

                _this.$list = $list.addClass( name + '-list' );
                _this.trigger( 'done', $el.addClass( name ), opts );

                //绑定相关event
                _this.bindEvent();

                _this.index = -1;
                _this.switchTo(opts.index);
            },

            /**
             * 切换到导航栏的某一项的具体实现函数
             */
            _switchTo: function( to, e ) {
                if ( to === this.index ) {
                    return;
                }

                var _this = this,
                    list = _this.$list.children(),
                    evt = Event( 'beforeselect', e ),
                    cur;

                _this.trigger( evt, list.get( to ) );

                cur = list.removeClass( 'ui-state-active' )
                    .eq( to )
                    .addClass( 'ui-state-active' );

                _this.index = to;
                return _this.select(to, cur[0] );
            },

            /**
             * 切换到导航栏的某一项
             */
            switchTo: function( to ) {
                return this._switchTo( ~~to );
            },

            /**
             * 选择
             */
            select: function(to, el){
                var _this = this,
                    opts = _this.settings;

                // 第一调用的时候没有prevIndex, 固根据this.index来控制方向。
                if ( _this.prevIndex === undefined ) {
                    _this.prevIndex = _this.index ? 0 : 1;
                }

                var dir = to > _this.prevIndex,

                // 如果是想左则找prev否则找next
                    target = $( el )[ dir ? 'next' : 'prev' ](),

                // 如果没有相邻的，自己的位置也需要检测。存在这种情况
                // 被点击的按钮，只显示了一半
                    offset = target.offset() || $( el ).offset(),
                    within = opts.navListObj.offset(),
                    listOffset;

                if ( dir ? offset.left + offset.width > within.left +
                    within.width : offset.left < within.left ) {
                    listOffset = _this.$list.offset();

                    opts.navListObj.iScroll( 'scrollTo', dir ? within.width -
                        offset.left + listOffset.left - offset.width :
                        listOffset.left - offset.left, 0, 400 );
                }

                _this.prevIndex = to;

                //ajax请求对应分类下的数据     ??最好抽取出去
                var $curItem = _this.$list.children().eq(to),
                    curId = $curItem.attr('data-id'),
                    curAjaxUrl = $curItem.attr('data-url'),
                    curMaxPage = parseInt($curItem.attr('data-maxPage'));

                opts.navItemContentObj.attr('data-curPage','2');

                $.ajax({
                    type: 'post',
                    url: curAjaxUrl,
                    data: {categoryId: curId, page: 1},
                    dataType: 'json',
                    success: function (res) {
                        if(res.flag){
                            if(res.navigatorItems.length){
                                var navigatorItemsObj = {navigatorItems: res.navigatorItems};

                                var resultStr = Mustache.render(opts.renderTpl.join(''),navigatorItemsObj);

                                opts.navItemContentObj.html(resultStr);

                                if(curMaxPage <= 1){
                                    opts.refreshDownObj.hide();

                                    _this.disable('down', true);
                                }else{
                                    opts.refreshDownObj.show();

                                    _this._setStyle('down','loaded');
                                    _this.enable('down');
                                }
                            }else{
                                opts.navItemContentObj.html('<div style="text-align:center;margin-top:80px;color:#A54093;font-size:20px;">暂无数据</div>');
                                opts.refreshDownObj.hide();

                                _this.disable('down', true);
                            }
                        }else{
                            errorTip(opts.errorTipObj,res.msg);
                        }
                    },
                    error: function (xhr, type) {
                        errorTip(opts.errorTipObj,'请求服务器异常,稍后再试');
                    }
                });
            },

            /**
             * 取消选择
             */
            unselect: function() {
                this.index = -1;
                this.$list.children().removeClass( 'ui-state-active' );
            },

            /**
             * 获取当前选中的序号
             */
            getIndex: function() {
                return this.index;
            },

            /**
             * 重写trigger
             */
            trigger: function( evt ) {
                var i = -1,
                    args,
                    events,
                    stoped,
                    len,
                    ev;

                if ( !this._events || !evt ) {
                    return this;
                }

                typeof evt === 'string' && (evt = new Event( evt ));

                args = slice.call( arguments, 1 );
                evt.args = args;    // handler中可以直接通过e.args获取trigger数据
                args.unshift( evt );

                events = findHandlers( this._events, evt.type );

                if ( events ) {
                    len = events.length;

                    while ( ++i < len ) {
                        if ( (stoped = evt.isPropagationStopped()) ||  false ===
                            (ev = events[ i ]).cb.apply( ev.ctx2, args )
                            ) {

                            // 如果return false则相当于stopPropagation()和preventDefault();
                            stoped || (evt.stopPropagation(), evt.preventDefault());
                            break;
                        }
                    }
                }

                return this;
            },

            /**
             * 刷新
             */
            refresh: function() {
                this.settings.navListObj.iScroll( 'refresh' );
            },

            /**
             * 上拉刷新相关event
             */
            _changeStyle: function (dir, state) {
                var opts = this.settings;

                switch (state) {
                    case 'loaded':
                        opts.refreshLabelObj.html('加载更多');
                        opts.refreshIconObj.removeClass();
                        opts._actDir = '';
                        break;
                    case 'loading':
                        opts.refreshLabelObj.html('加载中...');
                        opts.refreshIconObj.addClass('ui-loading');
                        opts._actDir = dir;
                        break;
                    case 'disable':
                        opts.refreshLabelObj.html('没有更多内容了');
                        break;
                }

                return this;
            },

            _setStyle: function (dir, state) {
                var _this = this,
                    stateChange = $.Event('statechange');

                _this.trigger(stateChange, _this.settings['$' + dir + 'Elem'], state, dir);
                if ( stateChange.defaultPrevented ) {
                    return _this;
                }

                return _this._changeStyle(dir, state);
            },

            /**
             * 用来设置加载是否可用，分方向的。
             * @param {String} dir 加载的方向（'up' | 'down'）
             * @param {String} status 状态（true | false）
             */
            _status: function(dir, status) {
                var opts = this.settings;

                return status === undefined ? opts['_' + dir + 'Open'] : opts['_' + dir + 'Open'] = !!status;
            },

            _setable: function (able, dir, hide) {
                var _this = this,
                    opts = _this.settings,
                    dirArr = dir ? [dir] : ['up', 'down'];

//                $.each(dirArr, function (i, dir) {
                    var $elem = opts.refreshDownObj;
                    if (!$elem.length) return;
                    //若是enable操作，直接显示，disable则根据text是否是true来确定是否隐藏
                    able ? $elem.show() : (hide ?  $elem.hide() : _this._setStyle(dir, 'disable'));
                    _this._status(dir, able);
//                });

                return _this;
            },

            /**
             * 如果已无类容可加载时，可以调用此方法来，禁用Refresh。
             * @param {String} dir 加载的方向（'up' | 'down'）
             * @param {Boolean} hide 是否隐藏按钮。如果此属性为false，将只有文字变化。
             */
            disable: function (dir, hide) {
                return this._setable(false, dir, hide);
            },

            /**
             * 启用组件
             * @param {String} dir 加载的方向（'up' | 'down'）
             */
            enable: function (dir) {
                return this._setable(true, dir);
            },

            _loadingAction: function (dir, type) {
                var _this = this,
                    opts = _this.settings,
                    loadFn = _this.load;

                $.isFunction(loadFn) && loadFn.call(_this, dir, type);
                _this._status(dir, false);

                return _this;
            },

            /**
             * 当组件调用load，在load中通过ajax请求内容回来后，需要调用此方法，来改变refresh状态。
             * @param {String} dir 加载的方向（'up' | 'down'）
             */
            afterDataLoading: function (dir) {
                var _this = this,
                    dir = dir || _this.settings._actDir;

                _this._setStyle(dir, 'loaded');
                _this._status(dir, true);

                return _this;
            },

            load: function(dir, type){
                var _this = this;

                var $list = _this.settings.navItemContentObj;

                if(parseInt($('li.ui-state-active').attr('data-maxPage')) >= parseInt($list.attr('data-curPage')) && dir === 'down'){
                    $.ajax({
                        type: 'post',
                        url: $('li.ui-state-active').attr('data-url'),
                        data: {categoryId: $('li.ui-state-active').attr('data-id'),page:parseInt($list.attr('data-curPage'))},
                        dataType: 'json',
                        success: function (res) {
                            if(parseInt($('li.ui-state-active').attr('data-maxPage')) >= parseInt($list.attr('data-curPage'))){
                                setTimeout(function(){
                                    var resultHtml = Mustache.render(_this.settings.renderTpl.join(''),res);

                                    $list['append'](resultHtml);
                                    _this.afterDataLoading();    //数据加载完成后改变状态

                                    $list.attr('data-curPage',parseInt($list.attr('data-curPage'))+1);

                                    if(parseInt($list.attr('data-curPage')) > parseInt($('li.ui-state-active').attr('data-maxPage'))){
                                        _this.disable('down', true);
                                    }
                                },500);
                            }
                        },
                        error: function (xhr, type) {
                            errorTip(_this.settings.errorTipObj,'请求服务器异常,稍后再试');
                        }
                    });
                }
            },

            _startHandler: function (e) {
                this.settings._startY = e.touches[0].pageY;
            },

            _endHandler: function () {
                var _this = this,
                    opts = _this.settings;
                _this._setStyle('down', 'loading');

                _this._loadingAction('down', 'pull');

                opts['_refreshing'] = false;
                return _this;
            },

            _moveHandler: function (e) {
                var _this = this,
                    opts = _this.settings,
                    startY = opts._startY,
                    movedY = startY - e.touches[0].pageY,
                    winHeight = opts._win.innerHeight,
                    threshold = opts.threshold || (opts.wrapperH < winHeight ? (opts.wrapperH / 2 + opts.wrapperTop || 0) : winHeight / 2);     //默认值为可视区域高度的一半，若wrapper高度不足屏幕一半时，则为list的一半

                if (!_this._status('down') || movedY < 0) return;
                if (!opts['_refreshing'] && (startY >= opts._body.scrollHeight - winHeight + threshold) && movedY > 10) {    //下边按钮，上拉加载
                    _this._setStyle('down', 'beforeload');
                    opts['_refreshing'] = true;
                }
                return _this;
            },

            _eventHandler: function (e) {
                var _this = this,
                    opts = _this.settings;

                switch (e.type) {
                    case 'touchstart':
                        _this._startHandler(e);
                        break;
                    case 'touchmove':
                        clearTimeout(opts._endTimer);        //解决部分android上，touchmove未禁用时，touchend不触发问题
                        opts._endTimer = setTimeout( function () {
                            _this._endHandler();
                        }, 300);
                        _this._moveHandler(e);
                        break;
                    case 'touchend':
                    case 'touchcancel':
                        clearTimeout(opts._endTimer);
                        opts._refreshing && _this._endHandler();
                        break;
                    case 'scrollStop':
                        (!opts._refreshing && opts._win.pageYOffset >= opts._body.scrollHeight - opts._win.innerHeight + (opts.threshold || -1)) && _this._endHandler();
                        break;
                }
                return _this;
            },

            /**
             * 绑定函数
             */
            bindEvent: function(){
                var _this = this,
                    opts = _this.settings,
                    $el = opts.navListObj,
                    $list = $el.find( 'ul' ).first();

                var $doc = $( document ),
                    $tapEl,    // 当前按下的元素
                    timer;

                //高亮默认选中项
                var dismiss = function(){
                    var cls = $tapEl.attr( 'hl-cls' );

                    clearTimeout( timer );
                    $tapEl.removeClass( cls ).removeAttr( 'hl-cls' );
                    $tapEl = null;
                    $doc.off( 'touchend touchmove touchcancel', dismiss );
                };

                var highlight = function( className, selector ) {
                    return $(selector).each(function(){
                        var $this = $( this );

                        $this.css( '-webkit-tap-highlight-color', 'rgba(255,255,255,0)' )
                            .off( 'touchstart.hl' );

                        className && $this.on( 'touchstart.hl', function( e ) {
                            var match;

                            $tapEl = selector ? (match = $( e.target ).closest( selector,
                                this )) && match.length && match : $this;

                            // selctor可能找不到元素。
                            if ( $tapEl ) {
                                $tapEl.attr( 'hl-cls', className );
                                timer = setTimeout( function() {
                                    $tapEl.addClass( className );
                                }, 100 );
                                $doc.on( 'touchend touchmove touchcancel',dismiss );
                            }
                        } );
                    });
                }

                highlight( 'ui-state-hover', 'li' );

                //点击'列表选项'
                $list.delegate('li:not(.ui-state-disable)>a','click',function( e ){
                    _this._switchTo($(this).parent().index(), e);
                });

                $(window).on( 'resize',function(){
                    _this.refresh();
                });

                $el.on('destroy', function(){
                    $el.iScroll( 'destroy' );
                    $(window).off( 'resize');
                });

                //设置iScroll相关参数
                $el.iScroll(opts.iScrollArg);

                //定义往上拉动态刷新data事件
                opts.pullAreaObj.on('touchstart touchmove touchend touchcancel', function(e){
                    opts.wrapperH = opts.pullAreaObj.height();
                    opts.wrapperTop = opts.pullAreaObj.offset().top;
                    opts._win = window;
                    opts._body = document.body;

                    _this._eventHandler(e);
                });
            }
        };

    /**
     * 默认配置
     */
    Navigation.defaults = {
        //导航列表父对象
        navListObj: null,

        //导航项的详情列表对象
        navItemContentObj: null,

        //上拉区域载体对象
        pullAreaObj: null,

        //上拉bar区域对象
        refreshDownObj: null,

        //上拉bar区域-icon对象
        refreshIconObj: null,

        //上拉bar区域-label对象
        refreshLabelObj: null,

        //异常提示语载体对象
        errorTipObj: null,

        //iScroll参数
        iScrollArg: {
            hScroll: true,
            vScroll: false,
            hScrollbar: false,
            vScrollbar: false,
            bounce:false
        },

         //菜单数组内容
        content: null,

        // 处于边缘，是否自动滚动的标示符
        isScrollToNext: true,

        //动态加载渲染模板
        renderTpl: ''
    };

    var rNavigation = function(options){
        new Navigation(options);
    };

    window.rNavigation = $.rNavigation = $.navigation = rNavigation;
});