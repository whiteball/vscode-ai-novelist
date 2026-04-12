(function () {
	const vscode = acquireVsCodeApi();

	const inputElement = document.getElementById('input');
	const outputElement = document.getElementById('output');
	const writeToEditorElement = document.getElementById('write-to-editor');

	// 保存済みの状態を復元する
	const state = vscode.getState();
	if (state) {
		if (inputElement instanceof HTMLTextAreaElement && state.input !== undefined) {
			inputElement.value = state.input;
		}
		if (outputElement instanceof HTMLTextAreaElement && state.output !== undefined) {
			outputElement.value = state.output;
		}
		if (writeToEditorElement instanceof HTMLInputElement && state.writeToEditor !== undefined) {
			writeToEditorElement.checked = state.writeToEditor;
		}
	}

	function saveState() {
		vscode.setState({
			input: inputElement instanceof HTMLTextAreaElement ? inputElement.value : '',
			output: outputElement instanceof HTMLTextAreaElement ? outputElement.value : '',
			writeToEditor: writeToEditorElement instanceof HTMLInputElement ? writeToEditorElement.checked : false,
		});
	}

	inputElement?.addEventListener('input', saveState);
	writeToEditorElement?.addEventListener('change', saveState);

	document.getElementById('send-button')?.addEventListener('click', function () {
		vscode.postMessage({
			type: 'send',
			text: inputElement instanceof HTMLTextAreaElement ? inputElement.value : '',
			writeToEditor: writeToEditorElement instanceof HTMLInputElement ? writeToEditorElement.checked : false,
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
