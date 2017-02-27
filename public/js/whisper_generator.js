var BITS_PER_WORD = 21;

var twoPi    = 6.28318530718;
var M_PI     = 3.14159265359;
var SR       = 44100;
var BIT0     = 17915;
var BIT1     = 18088;
var SYNC     = 17743;
var BIT_N    = 500;


const SHRT_MAX = 32767;
const SOUND_ATT = 24;

var bpf = [
	0.0054710543943477024,
	0.0040547458902157885,
	-0.0057670040125701975,
	-0.000420269477858772,
	0.0083101449460656479,
	-0.0094316312494859555,
	-0.00085337467579393997,
	0.019321089254230747,
	-0.036056446386691504,
	0.040575570927701025,
	-0.029111316718296438,
	0.0080225908019748802,
	0.0095672258114302307,
	-0.012393545345772288,
	-0.00043827074789732316,
	0.017048643633703134,
	-0.01908717711488702,
	-0.0062134875220540703,
	0.055444310421910982,
	-0.10711531788392055,
	0.13101476589622019,
	-0.10461944562931368,
	0.027517583158123228,
	0.074901277896690002,
	-0.16164355055964638,
	0.19552580900922636,
	-0.16164355055964638,
	0.074901277896690002,
	0.027517583158123228,
	-0.10461944562931368,
	0.13101476589622019,
	-0.10711531788392055,
	0.055444310421910982,
	-0.0062134875220540703,
	-0.01908717711488702,
	0.017048643633703134,
	-0.00043827074789732316,
	-0.012393545345772288,
	0.0095672258114302307,
	0.0080225908019748802,
	-0.029111316718296438,
	0.040575570927701025,
	-0.036056446386691504,
	0.019321089254230747,
	-0.00085337467579393997,
	-0.0094316312494859555,
	0.0083101449460656479,
	-0.000420269477858772,
	-0.0057670040125701975,
	0.0040547458902157885,
	0.0054710543943477024
];

var getWAV = function (pin) {

	try {
		var binaryMsg      = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		    msgWithHamming = [],
		    message        = [],
		    filteredMessage, i, j,
		    dbgMsg         = "",
		    digIn          = pin,
		    dig            = [];

		dig[0] = 5;
		dig[3] = digIn[0];
		dig[2] = digIn[1];
		dig[1] = digIn[2];
		dig[4] = 5;
		dig[7] = digIn[3];
		dig[6] = digIn[4];
		dig[5] = digIn[5];

		message.push.apply(message, _setBit(SYNC, -M_PI / 2, 1050, 0));

		var iWord;
		var iOdd = 0, iEven = 0, iBit = 0;
		for (iWord = 0; iWord < 2; iWord++) {
			dbgMsg         = "";
			//var iOdd=0, iEven=0, iBit=0;
			dig[iWord * 4] = 0;
			for (j = 1; j < 4; j++) {
				dbgMsg += ">> " + dig[j + iWord * 4];
				for (i = 0; i < 4; i++) {
					//noinspection JSBitwiseOperatorUsage
					if ((dig[j + iWord * 4] >> i) & 1) {
						//noinspection JSBitwiseOperatorUsage
						if (iBit & 0x1)
							iOdd++;
						else
							iEven++;
					}
					iBit++;
				}
			}
			/*if(!(iOdd % 2))
			 dig[iWord*4] |= 0x2;
			 else
			 dig[iWord*4] |= 0x1;
			 if(!(iEven % 2))
			 dig[iWord*4] |= 0x2 << 2;
			 else
			 dig[iWord*4] |= 0x1 << 2;
			 console.log(dbgMsg+' = Even:'+iEven+',Odd:'+iOdd +'=>dig:'+dig[iWord*4]);*/
		}
		//logger.debug(dbgMsg + ' = Even:' + iEven + ',Odd:' + iOdd);

		dig[0] = iOdd;
		dig[4] = iEven;
		//get overall number of 1s on odd and even positions
		dbgMsg = "";
		for (iWord = 0; iWord < 2; iWord++) {
			var iMsg = 0;

			for (i = 3; i >= 0; i--) {
				dbgMsg += "<" +
					dig[i + iWord * 4] + ">";
				var ibit;
				//console.log(" dig%d (%d)",i+iWord*4, dig[i+iWord*4]);
				for (ibit = 3; ibit >= 0;
				     ibit--) {
					//noinspection JSBitwiseOperatorUsage
					if (dig[i + iWord * 4] & (1 << ibit)) {
						binaryMsg[i * 4 + ibit] = 1;
					}
					else {
						binaryMsg[i * 4 + ibit] = 0;
					}

					if (!iMsg) {
						msgWithHamming[iWord * BITS_PER_WORD + iMsg++] = 0;
					}

					//noinspection JSBitwiseOperatorUsage
					while ((iMsg < 21) && (iMsg != 0) && !(
					iMsg & (iMsg - 1))) {
						msgWithHamming[iWord * BITS_PER_WORD + (iMsg++)] = 0;
					}
					msgWithHamming[iWord * BITS_PER_WORD + iMsg - 1] = binaryMsg[i * 4 + ibit];
					iMsg++;
				}
			}
			for (var iParity = 0; iParity < 5; iParity++) {
				var bitValidation = 0;
				for (i = (Math.pow(2, iParity)) - 1; i < BITS_PER_WORD; i += 2 * Math.pow(2, iParity)) {
					for (var innerBits = 0; (innerBits < Math.pow(2, iParity)) && ((innerBits + i) < BITS_PER_WORD); innerBits++) {
						var parNdx = i + innerBits + 1;
						//noinspection JSBitwiseOperatorUsage
						if (!(parNdx - 1) || !(parNdx & (parNdx - 1))) {
							dbgMsg += ".";
							//control bit - we do not include it in parity check
						}
						else {
							bitValidation += msgWithHamming[iWord * BITS_PER_WORD + parNdx - 1];
						}
					}
				}
				var ndx                                     = Math.pow(2, iParity) - 1;
				msgWithHamming[ndx + iWord * BITS_PER_WORD] = bitValidation & 0x1;
				//set '1' if number of '1's is odd
			}

			//logger.debug(dbgMsg);

			dbgMsg = "";

			for (i = 0; i < BITS_PER_WORD; i++) {
				//dbgMsg += msgWithHamming[iWord*BITS_PER_WORD + i];
				if (i == -1) {
					//set bit No 0-19 to insert error, use bits not power of 2
					if (msgWithHamming[iWord * BITS_PER_WORD + i])
						message.push.apply(message, _setBit(BIT0, -M_PI / 2, BIT_N, 0));
					else
						message.push.apply(message, _setBit(BIT1, M_PI / 2, BIT_N, 0));

				}
				else {
					if (msgWithHamming[iWord * BITS_PER_WORD + i])
						message.push.apply(message, _setBit(BIT1, M_PI / 2, BIT_N, 0));
					else
						message.push.apply(message, _setBit(BIT0, -M_PI / 2, BIT_N, 0));
				}
			}
			//console.log(dbgMsg);
		}

		message.push.apply(message, message);//1 sec
		message.push.apply(message, message);//2 sec
		message.push.apply(message, message);//4 sec

		filteredMessage = _convolve(message, message.length, bpf, bpf.length);
		message         = _convolve(filteredMessage, filteredMessage.length, bpf, bpf.length);

		var scale = SHRT_MAX / SOUND_ATT;
		for (i = 0; i < filteredMessage.length; i++) {
			filteredMessage[i] = message[i] * scale;
		}
		//$emit('newData',_generateWAV(filteredMessage));
		if(window.getNotifManagerInstance) window.getNotifManagerInstance().notify('NEW_DATA', _generateWAV(filteredMessage));

	} catch (e) {
		console.error(e);

	}

};

var _generateWAV = function (dataIn) {
	var channels      = 1,
	    sampleRate    = 44100,
	    bitsPerSample = 16,
	    seconds       = 4,
	    data          = [],
	    samples       = sampleRate;

	// Generate the sine waveform
	for (var i = 0; i < sampleRate * seconds; i++) {
		//for (var c = 0; c < channels; c++) {
		var v = dataIn[i];//volume * Math.sin((2 * Math.PI) * (i / sampleRate) * frequency);
		data.push(_pack("v", v));
		samples++;
		//}
	}

	data = data.join('');

	// Format sub-chunk
	var chunk1 = [
		"fmt ", // Sub-chunk identifier
		_pack("V", 16), // Chunk length
		_pack("v", 1), // Audio format (1 is linear quantization)
		_pack("v", channels),
		_pack("V", sampleRate),
		_pack("V", sampleRate * channels * bitsPerSample / 8), // Byte rate
		_pack("v", channels * bitsPerSample / 8),
		_pack("v", bitsPerSample)
	].join('');

	// Data sub-chunk (contains the sound)
	var chunk2 = [
		"data", // Sub-chunk identifier
		_pack("V", samples * channels * bitsPerSample / 8), // Chunk length
		data
	].join('');

	// Header
	var header = [
		"RIFF",
		_pack("V", 4 + (8 + chunk1.length) + (8 + chunk2.length)), // Length
		"WAVE"
	].join('');

	return [header, chunk1, chunk2].join('');

};

var _pack = function (fmt) {
	var output = '',
	    argi   = 1;

	for (var i = 0; i < fmt.length; i++) {
		var c   = fmt.charAt(i),
		    arg = arguments[argi];

		argi++;

		switch (c) {
			case "a":
				output += arg[0] + "\0";
				break;
			case "A":
				output += arg[0] + " ";
				break;
			case "C":
			case "c":
				output += String.fromCharCode(arg);
				break;
			case "n":
				output += String.fromCharCode((arg >> 8) & 255, arg & 255);
				break;
			case "v":
				output += String.fromCharCode(arg & 255, (arg >> 8) & 255);
				break;
			case "N":
				output += String.fromCharCode((arg >> 24) & 255, (arg >> 16) & 255, (arg >> 8) & 255, arg & 255);
				break;
			case "V":
				output += String.fromCharCode(arg & 255, (arg >> 8) & 255, (arg >> 16) & 255, (arg >> 24) & 255);
				break;
			case "x":
				argi--;
				output += "\0";
				break;
			default:
				throw new Error("Unknown _pack format character '" + c + "'");
		}
	}

	return output;
};

var _setBit = function (freq, phase, samples, padding) {
	var data = [];
	var i;
	for (i = 0; i < samples; i++) {
		if (i < samples - padding)
			data[i] =
				(Math.sin(phase + i * twoPi * (freq / SR)) +
				(Math.sin(phase + i * twoPi * ((freq - 10) / SR))) +
				(Math.sin(phase + i * twoPi * ((freq + 10) / SR)))+
				(Math.sin(phase + i * twoPi * ((freq + 20) / SR)))
			);
		else
			data[i] = 0;
	}
	return data;
};

var _convolve = function (x, x_length, h, h_length) {
	var n,
	    output    = [],
	    halfFiler = Math.round(h_length / 2 + 0.5),
	    nVal      = 0;

	for (n = 0; n < x_length + h_length - 1; n++) {
		var k;

		nVal             = 0;
		var filter_stage = (n < h_length) ? n : h_length - 1;
		for (k = 0; k <= filter_stage; k++) {
			nVal += h[k] * x[n - k];
		}
		if (n >= halfFiler && n < x_length + halfFiler) {
			output[n - halfFiler] = nVal;
		}
	}
	return output;
};


