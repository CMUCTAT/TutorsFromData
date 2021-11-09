(function() {
	
	function iFrameReady(iFrame, fn) {
		var timer;
		var fired = false;

		function ready() {
			if (!fired) {
				fired = true;
				clearTimeout(timer);
				fn.call(this);
			}
		}

		function readyState() {
			if (this.readyState === "interactive") {
				ready.call(this);
			}
		}

		// cross platform event handler for compatibility with older IE versions
		function addEvent(elem, event, fn) {
			if (elem.addEventListener) {
				return elem.addEventListener(event, fn);
			} else {
				return elem.attachEvent("on" + event, function () {
					return fn.call(elem, window.event);
				});
			}
		}

		function checkLoaded() {
			var doc = iFrame.contentDocument || iFrame.contentWindow.document;
			// We can tell if there is a dummy document installed because the dummy document
			// will have an URL that starts with "about:".  The real document will not have that URL
			if (doc.URL.indexOf("about:") !== 0) {
				if (doc.readyState === "interactive") {
					ready.call(doc);
				} else {
					// set event listener for DOMContentLoaded on the new document
					addEvent(doc, "DOMContentLoaded", ready);
					addEvent(doc, "readystatechange", readyState);
				}
			} else {
				// still same old original document, so keep looking for content or new document
				timer = setTimeout(checkLoaded, 1);
			}
		}
		checkLoaded();
	}
	
	var bc = new BroadcastChannel('student_transactions');
	var tutorFrame = document.getElementById('tutor_frame');
	const urlParams = new URLSearchParams(window.location.search);
	const myId = urlParams.get('tab_id');
	bc.onmessage = function(msg) {
		msg = msg.data;
		if (msg.to === myId) {
			switch(msg.type) {
				case 'problem_urls':
					window.__problemUrls = msg.data;
					window.__problemUrls.__current = -1;
					bc.postMessage({sender: myId, type: "next problem"});
				break;
				case 'load':
					
					iFrameReady(tutorFrame, function(e) {
						console.log("tutorFrame DOMContentLoaded event");
						tutorFrame.contentWindow.addEventListener("message", (e)=> {
							console.log("tutor frame got message", e.data);
							if (e.data.command === "tutorready") {
								window.__problemUrls.__current++;
								let tutor = tutorFrame.contentWindow.document.getElementById("interface").contentWindow;
								tutor.CTATConfiguration.set("run_problem_url", window.__problemUrls[window.__problemUrls.__current+1]);
								
								window.postMessage(e.data, "*");
							}
						});
					});
					
					tutorFrame.src = msg.data;
				break;
				case 'step': 
					let tutor = tutorFrame.contentWindow.document.getElementById("interface");
					let ctatSAI = new tutor.contentWindow.CTATSAI(msg.data.selection, msg.data.action, msg.data.input),
					stepType = "ATTEMPT";
					console.log("\tsend sai: "+msg.data.selection+","+msg.data.action+","+msg.data.input+", ("+(msg.data.tutored ? "" : "un")+"tutored)");
					tutor.contentWindow.CTATCommShell.commShell.processComponentAction(
																ctatSAI, //sai
																msg.data.tutored, //tutored
																true, //behavior recorded
																null,  //[deprecated]
																stepType, //log type
																null, //aTrigger
																msg.data.transactionID //transaction id
																);
				break;
			}
		}
	}
	
	window.addEventListener("message", (e)=> {
		var msg = e.data;
		console.log("got message ",msg);
		if (msg.command === "tutorready") {
			console.log("tutor ready msg");
			bc.postMessage({sender: myId, type: "send steps", data: window.__problemUrls.__current});
		}
	});
	
	bc.postMessage({sender:	myId, type: 'get urls'});
})();