// ==UserScript==
// @name         Kakuyomu helper
// @namespace    http://tampermonkey.net/
// @version      2023-12-27
// @description  try to take over the world!
// @author       You
// @match        https://kakuyomu.jp/*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var currentAudio = null;

    function getSentenceFromSelection(selection) {
        // Get the text from the selection range
        let text = selection.toString();

        // Regular expression to match a sentence
        let sentenceRegex = /[^.!?]*[.!?]/g;
        let sentences = text.match(sentenceRegex);

        if (sentences && sentences.length > 0) {
            // Return the first sentence (you may need to adjust this logic)
            return sentences[0];
        }

        return text; // Fallback to return the whole text if no sentence is found
    }

    // Function to handle click event on a paragraph
    function handleParagraphClick(event) {
        // Prevent default behavior
        event.preventDefault();

        // Get the text of the clicked paragraph
        var text = event.target.innerText.trim();
        // Get the current selection
        var selection = window.getSelection();
        // Check if there is highlighted text
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
            // Get the sentence from the selection
            text = getSentenceFromSelection(selection);
        }
        // Check if the text is not empty
        if (text) {
            console.log("Captured Text:", text);
            sendTextToVoiceVox(text, 1); // Replace '1' with the desired speaker ID
        }
    }

    function sendTextToVoiceVox(text, speakerId) {
        var host = '192.168.1.118'

        // First, get the audio query
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'http://' + host + ':50021/audio_query?text=' + encodeURIComponent(text) + '&speaker=' + speakerId,
            headers: {
                "accept": "application/json"
            },
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    var queryData = JSON.parse(response.responseText);
                    synthesizeVoice(queryData,  'http://' + host + ':50021/synthesis?speaker=' + speakerId);
                } else {
                    console.error('VoiceVox audio_query API error:', response.statusText);
                }
            },
            onerror: function(response) {
                console.error('VoiceVox audio_query API error:', response.statusText);
            }
        });
    }

    function synthesizeVoice(queryData, synthesisEndpoint) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: synthesisEndpoint,
            headers: {
                'Content-Type': 'application/json',
                'accept': 'audio/wav'
            },
            data: JSON.stringify(queryData),
            responseType: 'blob',
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    playAudioBlob(response.response);
                } else {
                    console.error('VoiceVox synthesis API error:', response.statusText);
                }
            },
            onerror: function(response) {
                console.error('VoiceVox synthesis API error:', response.statusText);
            }
        });
    }

    function playAudioBlob(blob) {
        var url = URL.createObjectURL(blob);

        if (currentAudio && !currentAudio.paused) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }

        currentAudio = new Audio(url);
        currentAudio.play();
    }


    document.querySelectorAll('p').forEach(function(paragraph) {
        paragraph.addEventListener('click', handleParagraphClick, false);
    });



})();
