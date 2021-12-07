(function() {
	
	var readyFired = {};
	
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
							let btn = tutor.document.querySelector('.CTATHintWindow--'+(msg.data.selection === "nextButton" ? "next" : "previous"));
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