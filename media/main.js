(function () {
	const vscode = acquireVsCodeApi();

	const inputElement = document.getElementById('input');
	const outputElement = document.getElementById('output');
	const writeToEditorElement = document.getElementById('write-to-editor');
	const thinkingModeElement = document.getElementById('thinking-mode');
	const useSelectionOnlyElement = document.getElementById('use-selection-only');
	const autoContinueThinkElement = document.getElementById('auto-continue-think');
	const thinkingElement = document.getElementById('thinking');
	const thinkingDetailsElement = document.getElementById('thinking-details');
	const optionDetailsElement = document.getElementById('option-details');

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
		if (thinkingModeElement instanceof HTMLInputElement && state.thinkingMode !== undefined) {
			thinkingModeElement.checked = state.thinkingMode;
		}
		if (useSelectionOnlyElement instanceof HTMLInputElement && state.useSelectionOnly !== undefined) {
			useSelectionOnlyElement.checked = state.useSelectionOnly;
		}
		if (autoContinueThinkElement instanceof HTMLInputElement && state.autoContinueThink !== undefined) {
			autoContinueThinkElement.checked = state.autoContinueThink;
		}
		if (thinkingElement instanceof HTMLTextAreaElement && state.thinking !== undefined) {
			thinkingElement.value = state.thinking;
		}
		if (thinkingDetailsElement instanceof HTMLDetailsElement && state.thinkingOpen !== undefined) {
			thinkingDetailsElement.open = state.thinkingOpen;
		}
		if (optionDetailsElement instanceof HTMLDetailsElement && state.optionOpen !== undefined) {
			optionDetailsElement.open = state.optionOpen;
		}
	}

	function saveState() {
		vscode.setState({
			input: inputElement instanceof HTMLTextAreaElement ? inputElement.value : '',
			output: outputElement instanceof HTMLTextAreaElement ? outputElement.value : '',
			writeToEditor: writeToEditorElement instanceof HTMLInputElement ? writeToEditorElement.checked : false,
			thinkingMode: thinkingModeElement instanceof HTMLInputElement ? thinkingModeElement.checked : true,
			useSelectionOnly: useSelectionOnlyElement instanceof HTMLInputElement ? useSelectionOnlyElement.checked : false,
			autoContinueThink: autoContinueThinkElement instanceof HTMLInputElement ? autoContinueThinkElement.checked : false,
			thinking: thinkingElement instanceof HTMLTextAreaElement ? thinkingElement.value : '',
			thinkingOpen: thinkingDetailsElement instanceof HTMLDetailsElement ? thinkingDetailsElement.open : false,
			optionOpen: optionDetailsElement instanceof HTMLDetailsElement ? optionDetailsElement.open : false,
		});
	}

	inputElement?.addEventListener('input', saveState);
	writeToEditorElement?.addEventListener('change', saveState);
	thinkingModeElement?.addEventListener('change', saveState);
	useSelectionOnlyElement?.addEventListener('change', saveState);
	autoContinueThinkElement?.addEventListener('change', saveState);
	thinkingDetailsElement?.addEventListener('toggle', saveState);
	optionDetailsElement?.addEventListener('toggle', saveState);

	document.getElementById('send-button')?.addEventListener('click', function () {
		vscode.postMessage({
			type: 'send',
			text: inputElement instanceof HTMLTextAreaElement ? inputElement.value : '',
			writeToEditor: writeToEditorElement instanceof HTMLInputElement ? writeToEditorElement.checked : false,
			thinkingMode: thinkingModeElement instanceof HTMLInputElement ? thinkingModeElement.checked : true,
			useSelectionOnly: useSelectionOnlyElement instanceof HTMLInputElement ? useSelectionOnlyElement.checked : false,
			autoContinueThink: autoContinueThinkElement instanceof HTMLInputElement ? autoContinueThinkElement.checked : false,
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
			case 'setThinking':
				{
					if (thinkingElement instanceof HTMLTextAreaElement) {
						thinkingElement.value = data.text;
						saveState();
					}
					break;
				}
		}
	});
}());
