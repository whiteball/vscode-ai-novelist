(function () {
	const vscode = acquireVsCodeApi();

	document.getElementById('send-button')?.addEventListener('click', function () {
		const element = document.getElementById('output');
		if (!element) {
			return;
		}

		const input = document.getElementById('input');
		vscode.postMessage({
			type: 'send',
			text: input?.value ?? ''
		});
	});
	window.addEventListener('message', function (event) {
		const data = event.data;
		switch (data.type) {
			case 'setOutput':
				{
					const outputElement = document.getElementById('output');
					if (outputElement instanceof HTMLTextAreaElement) {
						outputElement.value = data.text;
					}
					
					break;
				}
		}
	});
}());
