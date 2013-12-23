// Original from: http://bz.var.ru/comp/web/resizable-tables.js
//
// Resizable Table Columns.
//  version: 1.0
//
// (c) 2006, bz
//
// 25.12.2006:  first working prototype
// 26.12.2006:  now works in IE as well but not in Opera (Opera is @#$%!)
// 27.12.2006:  changed initialization, now just make class='resizable' in table and load script
//


(function($){
	$.fn.resizableColumns = function() {
		// get argument list passed and make into an array to use later
		var args = Array.prototype.slice.apply(arguments);
		
		return this.each(function() {
			var tElement = $(this);

			var table = tElement.get(0);
			if (table.tagName != 'TABLE') return;

			// ============================================================

            if (table.rows.length == 0) return;
			var dragColumns  = table.rows[0].cells; // first row columns, used for changing of width
			if (!dragColumns) return; // return if no table exists or no one row exists

			var dragColumnNo; // current dragging column
			var dragX;        // last event X mouse coordinate

			var settings = {
				onStop: null,
				widths : null
			},
			// setup default configuration value
	        instanceMethods = { 
				widths : function(values) {
					// apply widths
					for(var i=0; i< dragColumns.length && i < values.length; i++) {
						dragColumns[i].style.width = values[i];
	            	}
	            },
	            onStop : function(handler) {
	            	settings.onStop = handler;
	            }
	        };
					
			// the "data" in jQuery is used to keep track of instance state
	        if (tElement.data('resizableColumns-defined')) { 
	        	settings = tElement.data('resizableColumns-config'); 
	            if (args.length > 0) {
	                instanceMethods[args[0]].apply(this, args.slice(1,args.length));
	            }
	        } else {
	        	tElement.data('resizableColumns-defined', true);
	            if (args.length > 0 && $.isPlainObject(args[0])) {
	            	settings = $.extend(settings, args[0]);
	            }
	            tElement.data('resizableColumns-config', settings);
	        }
			
			
			// ============================================================
			// methods

			// ============================================================
			// do changes columns widths
			// returns true if success and false otherwise
			var changeColumnWidth = function(no, w) {
				if (!dragColumns) return false;

				if (no < 0) return false;
				if (dragColumns.length < no) return false;

				if (parseInt(dragColumns[no].style.width) <= -w) return false;
				if (dragColumns[no+1] && parseInt(dragColumns[no+1].style.width) <= w) return false;

				dragColumns[no].style.width = parseInt(dragColumns[no].style.width) + w +'px';
				if (dragColumns[no+1])
					dragColumns[no+1].style.width = parseInt(dragColumns[no+1].style.width) - w + 'px';

				return true;
			}

			// ============================================================
			// do drag column width
			var columnDrag = function(e) {
				var X = e.pageX;
				if (!changeColumnWidth(dragColumnNo, X - dragX)) {
					// stop drag!
					stopColumnDrag(e);
				}

				dragX = X;
				// prevent other event handling
				e.stopPropagation();
				return false;
			}

			// ============================================================
			// stops column dragging
			var stopColumnDrag = function(e) {
				if (!dragColumns) return;

				if(settings.onStop != null){
					var widths = [];
					for(var i=0; i< dragColumns.length; i++)
						widths.push(dragColumns[i].style.width);
					
					settings.onStop(widths);
				}
				
				// restore handlers & cursor
				$(document).unbind(e);
				$(document).unbind("mousemove", columnDrag);

				e.stopPropagation();
			}

			// ============================================================

			// prepare table header to be draggable
			// it runs during class creation
			tElement.find("th").each(function(index){
				var TH = $(this);
				var padd = TH.css("padding-right");
				// div around the title, to avoid unwanted click events. Dragging over this div won't fire click events.
				TH.wrapInner("<div class='tagname' style='height:100%;'></div>");
				// the drag slider
				$("<div class='slider' style='position:absolute;height:100%;width:5px;margin-right:-3px;"+
						"right:0px;top:0px;cursor:w-resize;z-index:10;'></div>").appendTo(TH);
				// content div
				TH.wrapInner("<div style='position:relative;height:100%;width:100%'></div>");
				// init data and start dragging
				TH.find(".slider")
				.css("margin-right", "-=" + padd)
				.bind("mousedown", function(e) {
					// remember dragging object
					dragColumnNo = index;
					dragX = e.pageX;

					// set up current columns widths in their particular attributes
					// do it in two steps to avoid jumps on page!
					var colWidth = new Array();
					for (var i=0; i<dragColumns.length; i++)
						colWidth[i] = $(dragColumns[i]).width();
					for (var i=0; i<dragColumns.length; i++) {
						dragColumns[i].width = ""; // for sure
						dragColumns[i].style.width = colWidth[i] + "px";
					}

					$(document).bind("mouseup", stopColumnDrag);
					$(document).bind("mousemove", columnDrag);

					e.stopPropagation();
					e.stopImmediatePropagation();
				});
			});
		});
	}
})(jQuery);
