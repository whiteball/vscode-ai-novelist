(function () {
	const vscode = acquireVsCodeApi();

	const inputElement = document.getElementById('input');
	const outputElement = document.getElementById('output');

	// 保存済みの状態を復元する
	const state = vscode.getState();
	if (state) {
		if (inputElement instanceof HTMLTextAreaElement && state.input !== undefined) {
			inputElement.value = state.input;
		}
		if (outputElement instanceof HTMLTextAreaElement && state.output !== undefined) {
			outputElement.value = state.output;
		}
	}

	function saveState() {
		vscode.setState({
			input: inputElement instanceof HTMLTextAreaElement ? inputElement.value : '',
			output: outputElement instanceof HTMLTextAreaElement ? outputElement.value : '',
		});
	}

	inputElement?.addEventListener('input', saveState);

	document.getElementById('send-button')?.addEventListener('click', function () {
		vscode.postMessage({
			type: 'send',
			text: inputElement instanceof HTMLTextAreaElement ? inputElement.value : ''
		});
	});

	window.addEventListener('message', function (event) {
		const data = event.data;
		switch (data.type) {
			case 'setOutput':
				{
					if (outputElement instanceof HTMLTextAreaElement) {
						outputElement.value = data.text;
						saveState();
					}
					break;
				}
		}
	});
}());
