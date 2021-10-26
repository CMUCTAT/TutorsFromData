(function() {
	var bc = new BroadcastChannel('student_transactions');
	var tutorFrame = document.getElementById('tutor_frame');
	const urlParams = new URLSearchParams(window.location.search);
	const myId = urlParams.get('tab_id');
	bc.onmessage = function(msg) {
		msg = msg.data;
		if (msg.to === myId) {
			switch(msg.type) {
				case 'load':
					tutorFrame.onload = function() {
						console.log("iframe load event");
						tutorFrame.window.addEventListener("noolsModelLoaded", ()=> {
							console.log("nools model loaded event");
						});
					};
					tutorFrame.src = msg.data;
				break;
				case 'step': 
					let ctatSAI = new CTATSAI(msg.data.selection, msg.data.action, msg.data.input),
					stepType = "ATTEMPT";
					console.log("\tsend sai: "+msg.data.selection+","+msg.data.action+","+msg.data.input+", ("+(msg.data.tutored ? "" : "un")+"tutored)");
					tutorFrame.window.CTATCommShell.commShell.processComponentAction(
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
	
	
	bc.postMessage({sender: myId, data: 'next problem'});
})();