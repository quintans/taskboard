/*
Copyright (c) 2011 Damien Antipa, http://www.nethead.at/, http://damien.antipa.at

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
/*
 * jQuery Plugin: Confirmation Dialog
 * 
 * Requirements: jQuery 1.6.4, Bootstrap 1.3.0
 * http://jquery.com/
 * http://twitter.github.com/bootstrap/
 * 
 * This Plugin can be used for anchors, to show a confirmation popup before redirecting to the link.
 * Original code by Damian Antipa <http://damien.antipa.at/2011/10/jquery-plugin-confirmation/>
 *
 */
(function($){
	$.fn.extend({
		confirmDialog: function(options) {
			var defaults = {
				//title: 'Confirmação',
				message: 'Tem certeza que deseja realizar esta operação?',				
				dialog: '<div id="confirm-dialog" class="popover">' +
							'<div class="arrow"></div>' +
							'<div class="popover-inner">' +
								//'<h3 class="popover-title"></h3>' +
							  	'<div class="popover-content">' +
							  		'<p class="message"></p>' +
									'<p class="button-group"><button class="btn btn-danger"></button>&nbsp;<button class="btn"></button></p>' +
							  	'</div>' +
							'</div>' +
						'</div>',
				okButton: 'Sim',
				cancelButton: 'Não',
				callback: null
			};
			var options =  $.extend(defaults, options);
			
			return this.each(function() {
				var o = options;
				var $elem = $(this)
				
				$elem.bind('click', function(e) {
					e.preventDefault();
					if(!$('#confirm-dialog').length) {
						
						var offset = $elem.offset();
						var $dialog = $(o.dialog).appendTo('body');
						
						//$dialog.find('h3.popover-title').html(o.title);
						
						$dialog.find('p.message').html('<strong>' + o.message + '</strong>');
						
						$dialog.find('button.btn:eq(0)').text(o.okButton).bind('click', function(e) {
							$dialog.remove();
							if(o.callback)
								o.callback();
						});
						
						$dialog.find('button.btn:eq(1)').text(o.cancelButton).bind('click', function(e) {
							$dialog.remove();
						});
						
						$dialog.bind('mouseleave', function() {
							$dialog.fadeOut('slow', function() {
								$dialog.remove();
							});
						});

						var x;
						if(offset.left > $dialog.width()) {
							//dialog can be left
							x = e.pageX - $dialog.width() - 20; 
							$dialog.addClass('left');
						} else {
							x = e.pageX + 10;
							$dialog.addClass('right');
						}
						var y = e.pageY - $dialog.height() / 2 - $elem.innerHeight() / 2;
	
						$dialog.css({
							display: 'block',
							position: 'absolute',
							top: y,
							left: x
						});
						
						$dialog.find('p.button-group').css({
							marginTop: '5px',
							textAlign: 'right'
						});

						$dialog.find('a.btn').css({
							marginLeft: '3px'
						});

					}
				});
			});
		}
	});   
})(jQuery);