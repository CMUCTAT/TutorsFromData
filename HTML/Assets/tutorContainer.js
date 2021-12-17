(function() {
	
	var bc = new BroadcastChannel('student_transactions');
	const urlParams = new URLSearchParams(window.location.search);
	const myId = urlParams.get('student_name');
	var tutor;
	
	bc.onmessage = function(msg) {
		msg = msg.data;
		if (msg.to === myId) {
			switch(msg.type) {
				case 'next_problem_url':
					tutor.CTATConfiguration.set("run_problem_url", msg.data);
					bc.postMessage({sender: myId, type: "send steps"});
				break;
				case 'step': 
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
				case 'end of steps': 
					window.alert("There are no more steps for this student");
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
				tutor = document.getElementById("interface").contentWindow;
				bc.postMessage({sender: myId, type: "get next url"});
				break;
		}
	});
	
	document.addEventListener('freeze', ()=> {
		console.log("freeze event handler");
	});
	
})();