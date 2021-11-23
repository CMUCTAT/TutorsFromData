(function() {
	
	var readyFired = {};
	function iFrameReady(iFrame, fn) {
		var timer;

		function ready() {
			var doc = iFrame.contentDocument || iFrame.contentWindow.document;
			console.log("ready...");
			if (!readyFired[doc.URL]) {
				console.log("haven't fired for this url, firing");
				readyFired[doc.URL] = true;
				clearTimeout(timer);
				fn.call(this);
			} else {
				console.log("already fired for this url, ignoring");
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
			
			console.log("checkLoaded, url is ",doc.URL);
			
			// We can tell if there is a dummy document installed because the dummy document
			// will have an URL that starts with "about:".  The real document will not have that URL
			if (doc.URL.indexOf("about:") !== 0) {
				if (!readyFired[doc.URL]) {
					if (doc.readyState === "interactive") {
						ready.call(doc);
					} else {
						// set event listener for DOMContentLoaded on the new document
						addEvent(doc, "DOMContentLoaded", ready);
						addEvent(doc, "readystatechange", readyState);
					}
				} else {
					console.log("already fired for this url, waiting");
					timer = setTimeout(checkLoaded, 1);
				}
			} else {
				// still same old original document, so keep looking for content or new document
				console.log("dummy doc, waiting");
				timer = setTimeout(checkLoaded, 1);
			}
		}
		checkLoaded();
	}
	
	function sendReadyMsg(interfaceFrame) {
		window.__problemUrls.__current++;
		interfaceFrame.CTATConfiguration.set("run_problem_url", window.__problemUrls[window.__problemUrls.__current+1]);
		interfaceFrame.CTATCommShell.commShell.addGlobalEventListener({
			processCommShellEvent: function(e, msg) {
				console.log("processCommShellEvent: ",e);
				if (e === "CorrectAction" && msg.getSAI().getSelection() === "done") {
					window.postMessage({command: "problem_over"});
				}
			}
		});
		window.postMessage({command: "tutorready"}, "*");
	}
	
	function addNMLEvent(tFrame) {
		let interfaceFrame = tutorFrame.contentWindow.document.getElementById("interface");
		if (interfaceFrame) {
			interfaceFrame = interfaceFrame.contentWindow;
			if (interfaceFrame.document.getElementById("scrim")) {
				interfaceFrame.addEventListener("noolsModelLoaded", ()=> {
					
					console.log("noolsModelLoaded event sending ready msg");
					sendReadyMsg(interfaceFrame);
				});
			} else {
				console.log("scrim already down, sending ready msg");
				sendReadyMsg(interfaceFrame);
			}
		} else {
			console.log("interface frame not exist yet, polling...");
			setTimeout(addNMLEvent.bind(this, tFrame), 1);
		}
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
					
					tutorFrame.onload = function() {
						
						console.log("tutorFrame onload");
					//	addNMLEvent(tutorFrame);
					};
					
					
					tutorFrame.src = msg.data;
				break;
				case 'step': 
					let tutor = tutorFrame.contentWindow.document.getElementById("interface").contentWindow;
					let ctatSAI = new tutor.CTATSAI(msg.data.selection, msg.data.action, msg.data.input);
					if (!tutor.CTATShellTools.getReservedSelection(ctatSAI)) {
						let stepType = "ATTEMPT";
						console.log("\tsend sai: "+msg.data.selection+","+msg.data.action+","+msg.data.input+", ("+(msg.data.tutored ? "" : "un")+"tutored)");
						tutor.CTATCommShell.commShell.processComponentAction(
																	ctatSAI, //sai
																	msg.data.tutored, //tutored
																	true, //behavior recorded
																	null,  //[deprecated]
																	stepType, //log type
																	null, //aTrigger
																	msg.data.transactionID //transaction id
																	);
					} else {
						console.log("reserved selection, sending click event...");
						if (msg.data.selection === "nextButton" || msg.data.selection === "previousButton") {
							var clickEvent = new MouseEvent("click", {
								"view": tutor,
								"bubbles": true,
								"cancelable": false
							});
							let btn = tutor.document.getElementById(msg.data.selection);
							btn.dispatchEvent(clickEvent);
						}
					/*	
						let interfaceMsg = tutor.ProblemStateSaver.jsonToXML([{o: "H", m: "I", s: msg.data.selection, a: msg.data.action, i: msg.data.input}]);
						interfaceMsg = interfaceMsg[0].msg;
						console.log(interfaceMsg);
						tutor.CTAT.ToolTutor.sendToInterface(interfaceMsg);
					*/
					}
				break;
			}
		}
	}
	
	window.addEventListener("message", (e)=> {
		var msg = e.data;
		console.log("got message ",msg);
		switch(msg.command) {
			case "tutorready":
				console.log("tutor ready msg");
				
				let interfaceFrame = tutorFrame.contentWindow.document.getElementById("interface").contentWindow;
				window.__problemUrls.__current++;
				interfaceFrame.CTATConfiguration.set("run_problem_url", window.__problemUrls[window.__problemUrls.__current+1]);
				interfaceFrame.CTATCommShell.commShell.addGlobalEventListener({
					processCommShellEvent: function(e, msg) {
						console.log("processCommShellEvent: ",e);
						if (e === "CorrectAction" && msg.getSAI().getSelection() === "done") {
							window.postMessage({command: "problem_over"});
						}
					}
				});
				
				bc.postMessage({sender: myId, type: "send steps", data: window.__problemUrls.__current});
				break;
			case "problem_over":
				console.log("problem done msg");
				break;
		}  
	});
	
	bc.postMessage({sender:	myId, type: 'get urls'});
})();