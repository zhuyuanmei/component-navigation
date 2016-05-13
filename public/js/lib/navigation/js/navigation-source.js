/**
 * 导航内部滑动模块
 * @author zym
 * @version 1.0
 * @since 2016-05-09
 */
define(function(require, exports, module) {
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
                prevIndex = 0;

                var _this = this,
                    opts = _this.settings,
                    $el = opts.navListObj,
                    $list = $el.find( 'ul' ).first(),
                    name = 'ui-navigator',
                    renderer,
                    html;

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

                var $scroller = $('<div class="ui-scroller"></div>');

                $el.html($scroller);

                $scroller.html($list);

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
                if ( prevIndex === undefined ) {
                    prevIndex = _this.index ? 0 : 1;
                }

                var dir = to > prevIndex,

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

                prevIndex = to;
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
            }
        };

    /**
     * 默认配置
     */
    Navigation.defaults = {
        //导航元素对象
        navListObj: null,

        //iScroll参数
        iScroll: {
            hScroll: true,
            vScroll: false,
            hScrollbar: false,
            vScrollbar: false
        },

         //菜单数组内容
        content: null,

        // 处于边缘，是否自动滚动的标示符
        isScrollToNext: true
    };

    var rNavigation = function(options){
        new Navigation(options);
    };

    window.rNavigation = $.rNavigation = $.navigation = rNavigation;
});