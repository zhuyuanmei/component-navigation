# component-navigation
组件名称：导航内部滑动<br>
组件功能：导航内部滑动特效<br>
组件参数：

$.navigation({

            //导航列表父对象
            navListObj: $('#J_NavList'),

            //导航项的详情列表对象
            navItemContentObj: $('#J_NavItemContent'),

            //上拉区域载体对象
            pullAreaObj: $('#J_PullAreaObj'),

            //上拉bar区域对象
            refreshDownObj: $('.ui-refresh-down'),

            //上拉bar区域-icon对象
            refreshIconObj: $('.ui-refresh-icon'),

            //上拉bar区域-label对象
            refreshLabelObj: $('.ui-refresh-label'),

            //异常提示语载体对象
            errorTipObj: $('#J_ErrorTip'),
            
            //动态加载渲染模板
            renderTpl: tpl.navigatorItemsCont
        });
