(function(win, $) {
    const DEBUG = false;
    function debug(msg) {
        if (DEBUG) {
            console.log("debug: " + Date.now() + " " + msg);
        }
    }
    function init() {
        initialized = true;
        setupRegions();
        setInterval(setupRegions, 18E4);
        canvas = cv = document.getElementById("canvas");
        ctx = canvas.getContext("2d");
        canvas.onmousedown = function(e) {
            if (isMobile) {
                var x0 = e.clientX - (5 + width / 5 / 2);
                var y0 = e.clientY - (5 + width / 5 / 2);
                if (Math.sqrt(x0 * x0 + y0 * y0) <= width / 5 / 2) {
                    updateMousePosition();
                    sendPacket(17);
                    return;
                }
            }
            mouseX = e.clientX;
            mouseY = e.clientY;
            updateMouseAim();
            updateMousePosition();
        };
        canvas.onmousemove = function(e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
            updateMouseAim();
        };
        canvas.onmouseup = function() {};
        if (/firefox/i.test(navigator.userAgent)) {
            document.addEventListener("DOMMouseScroll", onDocumentMouseScroll, false);
        } else {
            document.body.onmousewheel = onDocumentMouseScroll;
        }
        var keySpacePressed = false;
        var keyQPressed = false;
        var keyWPressed = false;
        var keyEPressed = false; //XXX
        win.onkeydown = function(event) {
            if (32 == event.keyCode) {
                if (!keySpacePressed) {
                    updateMousePosition();
                    sendPacket(17);
                    keySpacePressed = true;
                }
            }
            if (81 == event.keyCode) {
                if (!keyQPressed) {
                    sendPacket(18);
                    keyQPressed = true;
                }
            }
            if (87 == event.keyCode) {
                if (!keyWPressed) {
                    updateMousePosition();
                    sendPacket(21);
                    keyWPressed = true;
                }
            }
            if (69 == event.keyCode) { //XXX
                if (!keyEPressed) {
                    keyEPressed = true;
                    timerE();
                }
            }
            if (27 == event.keyCode) { //XXX
                if ($("#overlays").css("display") == "none") {
                    showOverlays(true);
                } else {
                    hide();
                }
            }
        };
        win.onkeyup = function(event) {
            if (32 == event.keyCode) {
                keySpacePressed = false;
            }
            if (87 == event.keyCode) {
                keyWPressed = false;
            }
            if (81 == event.keyCode) {
                if (keyQPressed) {
                    sendPacket(19);
                    keyQPressed = false;
                }
            }
            if (69 == event.keyCode) { //XXX
                if (keyEPressed) {
                    keyEPressed = false;
                }
            }
        };
        win.onblur = function() {
            sendPacket(19);
            keyWPressed = keyQPressed = keySpacePressed = keyEPressed = false; //XXX
        };
        function timerE () { //XXX
            if (keyEPressed) {
                updateMousePosition();
                sendPacket(21);
                setInterval(timerE, 200);
            }
        }
        win.onresize = onResize;
        if (win.requestAnimationFrame) {
            win.requestAnimationFrame(tick);
        } else {
            setInterval(draw, 1E3 / 60);
        }
        setInterval(updateMousePosition, 40);
        if (region) {
            $("#region").val(region);
        }
        setupPlayerRegion();
        setRegion($("#region").val());
        if (null == socket) {
            if (region) {
                connect();
            }
        }
        $("#overlays").show();
        $.each(skins, function(v, node) { //XXX
            $("#nicks").append($("<option></option>").attr("value", v).text(node));
        });
        onResize();
        setupSettings();
    }
    function onDocumentMouseScroll(event) {
        zoom *= Math.pow(0.9, event.wheelDelta / -120 || (event.detail || 0));
        if (!isUnlimitedZoom) { //XXX
            if (1 > zoom) {
                zoom = 1;
            }
            if (zoom > 4 / ratio) {
                zoom = 4 / ratio;
            }
        }
    }
    function update() {
        if (0.4 > ratio) {
            context = null;
        } else {
            var minX = Number.POSITIVE_INFINITY;
            var minY = Number.POSITIVE_INFINITY;
            var maxX = Number.NEGATIVE_INFINITY;
            var maxY = Number.NEGATIVE_INFINITY;
            var maxSize = 0;
            var i = 0;
            for (; i < list.length; i++) {
                var data = list[i];
                if (!!data.shouldRender()) {
                    if (!data.wasSimpleDrawing) {
                        if (!(20 >= data.size * ratio)) {
                            maxSize = Math.max(data.size, maxSize);
                            minX = Math.min(data.x, minX);
                            minY = Math.min(data.y, minY);
                            maxX = Math.max(data.x, maxX);
                            maxY = Math.max(data.y, maxY);
                        }
                    }
                }
            }
            context = path.init({
                minX: minX - (maxSize + 100),
                minY: minY - (maxSize + 100),
                maxX: maxX + (maxSize + 100),
                maxY: maxY + (maxSize + 100),
                maxChildren: 2,
                maxDepth: 4
            });
            i = 0;
            for (; i < list.length; i++) {
                if (data = list[i], data.shouldRender() && !(20 >= data.size * ratio)) {
                    var j = 0;
                    var x = 0;
                    var y = 0;
                    for (; j < data.points.length; ++j) {
                        x = data.points[j].x;
                        y = data.points[j].y;
                        if (!(x < offsetX - width / 2 / ratio)) {
                            if (!(y < offsetY - height / 2 / ratio)) {
                                if (!(x > offsetX + width / 2 / ratio)) {
                                    if (!(y > offsetY + height / 2 / ratio)) {
                                        context.insert(data.points[j]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    function updateMouseAim() {
        aimX = (mouseX - width / 2) / ratio + offsetX;
        aimY = (mouseY - height / 2) / ratio + offsetY;
    }
    function setupRegions() {
        if (null == regions) {
            regions = {};
            $("#region").children().each(function() {
                var option = $(this);
                var name = option.val();
                if (name) {
                    regions[name] = option.text();
                }
            });
        }
        $.get(protocol + "//m.agar.io/info", function(input) {
            var regionsData = {};
            var name;
            for (name in input.regions) {
                var sourceName = name.split(":")[0];
                regionsData[sourceName] = regionsData[sourceName] || 0;
                regionsData[sourceName] += input.regions[name].numPlayers;
            }
            for (name in regionsData) {
                $('#region option[value="' + name + '"]').text(regions[name] + " (" + regionsData[name] + " players)");
            }
        }, "json");
    }
    function hide() {
        $("#adsBottom").hide();
        $("#overlays").hide();
        setupPlayerRegion();
    }
    function setupSettings() {
        if (typeof win.localStorage.checkSpectate != 'undefined') {
            $("#checkSpectate").prop('checked', win.localStorage.checkSpectate == "true").change();
        }
        if (typeof win.localStorage.checkSkins != 'undefined') {
            $("#checkSkins").prop('checked', win.localStorage.checkSkins == "true").change();
        }
        if (typeof win.localStorage.checkNames != 'undefined') {
            $("#checkNames").prop('checked', win.localStorage.checkNames == "true").change();
        }
        if (typeof win.localStorage.checkDarkTheme != 'undefined') {
            $("#checkDarkTheme").prop('checked', win.localStorage.checkDarkTheme == "true").change();
        }
        if (typeof win.localStorage.checkColorsOff != 'undefined') {
            $("#checkColorsOff").prop('checked', win.localStorage.checkColorsOff == "true").change();
        }
        if (typeof win.localStorage.checkShowMass != 'undefined') {
            $("#checkShowMass").prop('checked', win.localStorage.checkShowMass == "true").change();
        }
        if (typeof win.localStorage.checkShowBorders != 'undefined') {
            $("#checkShowBorders").prop('checked', win.localStorage.checkShowBorders == "true").change();
        }
        if (typeof win.localStorage.checkUnlimitedZoom != 'undefined') {
            $("#checkUnlimitedZoom").prop('checked', win.localStorage.checkUnlimitedZoom == "true").change();
        }
        if (typeof win.localStorage.checkInteractiveColors != 'undefined') {
            $("#checkInteractiveColors").prop('checked', win.localStorage.checkInteractiveColors == "true").change();
        }
        if (typeof win.localStorage.checkTransparent != 'undefined') {
            $("#checkTransparent").prop('checked', win.localStorage.checkTransparent == "true").change();
        }
        if (typeof win.localStorage.checkVirusTransparent != 'undefined') {
            $("#checkVirusTransparent").prop('checked', win.localStorage.checkVirusTransparent == "true").change();
        }
        if (typeof win.localStorage.checkLargeBlobBorders != 'undefined') {
            $("#checkLargeBlobBorders").prop('checked', win.localStorage.checkLargeBlobBorders == "true").change();
        }
        if (typeof win.localStorage.checkLargeNames != 'undefined') {
            $("#checkLargeNames").prop('checked', win.localStorage.checkLargeNames == "true").change();
        }
        if (typeof win.localStorage.checkAcidMode != 'undefined') {
            $("#checkAcid").prop('checked', win.localStorage.checkAcidMode == "true").change();
        }
        if (typeof win.localStorage.checkSimpleMode != 'undefined') {
            $("#checkSimpleMode").prop('checked', win.localStorage.checkSimpleMode == "true").change();
        }
    }
    function setRegion(input) {
        if (input) {
            if (input != region) {
            if ($("#region").val() != input) {
                $("#region").val(input);
            }
            region = win.localStorage.location = input;
            $(".region-message").hide();
            $(".region-message." + input).show();
            $(".btn-needs-server").prop("disabled", false);
            if (initialized) {
                connect();
            }
            }
        }
    }
    function showOverlays(isAlive) {
        nick = null;
        $("#overlays").fadeIn(isAlive ? 200 : 3E3);
        if (!isAlive) {
            $("#adsBottom").fadeIn(3E3);
        }
    }
    function setupPlayerRegion() {
        if ($("#region").val()) {
            win.localStorage.location = $("#region").val();
        } else {
            if (win.localStorage.location) {
                $("#region").val(win.localStorage.location);
            }
        }
        //XXX
    }
    function findServer() {
        console.log("Find " + region + gameMode);
        $.ajax(protocol + "//m.agar.io/", {
            error: function() {
                setTimeout(findServer, 1E3);
            },
            success: function(status) {
                status = status.split("\n");
                if (status[2]) {
                    alert(status[2]);
                }
                open("ws://" + status[0], status[1]);
            },
            dataType: "text",
            method: "POST",
            cache: false,
            crossDomain: true,
            data: (region + gameMode || "?") + "\n154669603"
        });
    }
    function connect() {
        if (initialized) {
            if (region) {
                $("#connecting").show();
                findServer();
            }
        }
    }
    function open(url, token) {
        debug("open -> " + url + " " + token);
        if (socket) {
            socket.onopen = null;
            socket.onmessage = null;
            socket.onclose = null;
            try {
                socket.close();
            } catch (e) {}
            socket = null;
        }
        if (isSecure) {
            var urlSplit = url.split(":");
            url = urlSplit[0] + "s://ip-" + urlSplit[1].replace(/\./g, "-").replace(/\//g, "") + ".tech.agar.io:" + (+urlSplit[2] + 2E3);
        }
        ids = [];
        playerGroup = [];
        blobs = {};
        list = [];
        sprites = [];
        users = [];
        img = angles = null;
        score = 0;
        qwe11 = false;
        $("#server_ip").val(url); //XXX
        $("#server_token").val(token); //XXX
        console.log("Connecting to " + url);
        socket = new WebSocket(url);
        socket.binaryType = "arraybuffer";
        socket.onopen = function() {
            console.log("socket open");
            var buffer = createBuffer(5);
            buffer.setUint8(0, 254);
            buffer.setUint32(1, 4, true);
            socketWrite(buffer);
            buffer = createBuffer(5);
            buffer.setUint8(0, 255);
            buffer.setUint32(1, 154669603, true);
            socketWrite(buffer);
            buffer = createBuffer(1 + token.length);
            buffer.setUint8(0, 80);
            var c = 0;
            for (; c < token.length; ++c) {
                buffer.setUint8(c + 1, token.charCodeAt(c));
            }
            socketWrite(buffer);
            sendNick();
        }
        socket.onmessage = socketMessage;
        socket.onclose = socketClose;
        socket.onerror = function() {
            console.log("socket error");
        };
    }
    function createBuffer(bytes) {
        return new DataView(new ArrayBuffer(bytes));
    }
    function socketWrite(array) {
        socket.send(array.buffer);
    }
    function socketClose() {
        if (qwe11) {
            backoff = 500;
        }
        $("#connecting").hide();
        console.log("socket close");
        setTimeout(connect, backoff);
        backoff *= 2;
    }
    function socketMessage(a) {
        parse(new DataView(a.data));
    }
    function parse(reader) {
        function encode() {
            var str = "";
            for (;;) {
                var qwe1 = reader.getUint16(offset, true);
                offset += 2;
                if (0 == qwe1) {
                    break;
                }
                str += String.fromCharCode(qwe1);
            }
            return str;
        }
        var offset = 0;
        if (240 == reader.getUint8(offset)) {
            offset += 5;
        }
        switch (reader.getUint8(offset++)) {
            case 16:
                qweR(reader, offset);
                break;
            case 17:
                middleX = reader.getFloat32(offset, true);
                offset += 4;
                middleY = reader.getFloat32(offset, true);
                offset += 4;
                chunk = reader.getFloat32(offset, true);
                offset += 4;
                break;
            case 20:
                playerGroup = [];
                ids = [];
                break;
            case 21:
                targetX = reader.getInt16(offset, true);
                offset += 2;
                targetY = reader.getInt16(offset, true);
                offset += 2;
                if (!isTargeting) {
                    isTargeting = true;
                    targetBufferX = targetX;
                    targetBufferY = targetY;
                }
                break;
            case 32:
                ids.push(reader.getUint32(offset, true));
                offset += 4;
                break;
            case 49:
                if (null != angles) {
                    break;
                }
                var usersCount = reader.getUint32(offset, true);
                offset = offset + 4;
                users = [];
                var i = 0;
                for (; i < usersCount; ++i) {
                    var userID = reader.getUint32(offset, true);
                    offset = offset + 4;
                    users.push({
                        id: userID,
                        name: encode()
                    });
                }
                render();
                break;
            case 50:
                angles = [];
                var qwe3 = reader.getUint32(offset, true);
                offset += 4;
                var i = 0;
                for (; i < qwe3; ++i) {
                    angles.push(reader.getFloat32(offset, true));
                    offset += 4;
                }
                render();
                break;
            case 64:
                minX = reader.getFloat64(offset, true);
                offset += 8;
                minY = reader.getFloat64(offset, true);
                offset += 8;
                maxX = reader.getFloat64(offset, true);
                offset += 8;
                maxY = reader.getFloat64(offset, true);
                offset += 8;
                middleX = (maxX + minX) / 2;
                middleY = (maxY + minY) / 2;
                chunk = 1;
                if (0 == playerGroup.length) {
                    offsetX = middleX;
                    offsetY = middleY;
                    ratio = chunk;
                };
        }
    }
    function qweR(reader, offset) {
        timestampLastDraw = +new Date;
        qwe11 = true;
        $("#connecting").hide();
        var rand = Math.random();
        qweA = false;
        var qweS = reader.getUint16(offset, true);
        offset += 2;
        var i = 0;
        for (; i < qweS; ++i) {
            var blob1 = blobs[reader.getUint32(offset, true)];
            var blob2 = blobs[reader.getUint32(offset + 4, true)];
            offset += 8;
            if (blob1) {
                if (blob2) {
                    blob2.destroy();
                    blob2.oX = blob2.x;
                    blob2.oY = blob2.y;
                    blob2.oSize = blob2.size;
                    blob2.nX = blob1.x;
                    blob2.nY = blob1.y;
                    blob2.nSize = blob2.size;
                    blob2.updateTime = timestampLastDraw;
                }
            }
        }
        i = 0;
        for (;;) {
            var id = reader.getUint32(offset, true);
            offset += 4;
            if (0 == id) {
                break;
            }
            ++i;
            var x = reader.getInt16(offset, true);
            offset += 2;
            var y = reader.getInt16(offset, true);
            offset += 2;
            var size = reader.getInt16(offset, true);
            offset += 2;
            var color = reader.getUint8(offset++);
            var flags = reader.getUint8(offset++);
            var isVirus = reader.getUint8(offset++);
            color = (color << 16 | flags << 8 | isVirus).toString(16);
            for (; 6 > color.length;) {
                color = "0" + color;
            }
            color = "#" + color;
            flags = reader.getUint8(offset++);
            isVirus = !!(flags & 1);
            var isAgitated = !!(flags & 16);
            if (flags & 2) {
                offset += 4;
            }
            if (flags & 4) {
                offset += 8;
            }
            if (flags & 8) {
                offset += 16;
            }
            var readChar;
            var name = "";
            for (;;) {
                readChar = reader.getUint16(offset, true);
                offset += 2;
                if (0 == readChar) {
                    break;
                }
                name += String.fromCharCode(readChar);
            }
            var blob = null;
            if (blobs.hasOwnProperty(id)) {
                blob = blobs[id];
                blob.updatePos();
                blob.oX = blob.x;
                blob.oY = blob.y;
                blob.oSize = blob.size;
                blob.color = color;
            } else {
                blob = new Blob(id, x, y, size, color, name);
                list.push(blob);
                blobs[id] = blob;
                blob.pX = x;
                blob.pY = y;
            }
            blob.isVirus = isVirus;
            blob.isAgitated = isAgitated;
            blob.nX = x;
            blob.nY = y;
            blob.nSize = size;
            blob.updateCode = rand;
            blob.updateTime = timestampLastDraw;
            blob.flags = flags;
            if (name) {
                blob.setName(name);
            }
            if (-1 != ids.indexOf(id)) {
                if (-1 == playerGroup.indexOf(blob)) {
                    document.getElementById("overlays").style.display = "none";
                    playerGroup.push(blob);
                    if (1 == playerGroup.length) {
                        offsetX = blob.x;
                        offsetY = blob.y;
                    }
                }
            }
        }
        var qweT = reader.getUint32(offset, true);
        offset += 4;
        i = 0;
        for (; i < qweT; i++) {
            var qwe4 = reader.getUint32(offset, true);
            offset += 4;
            blob = blobs[qwe4];
            if (null != blob) {
                blob.destroy();
            }
        }
        if (qweA) {
            if (0 == playerGroup.length) {
                showOverlays(false);
            }
        }
    }
    function updateMousePosition() {
        if (isSocketOpen()) {
            var normalizeX = mouseX - width / 2;
            var normalizeY = mouseY - height / 2;
            if (!(64 > normalizeX * normalizeX + normalizeY * normalizeY)) {
                if (!(0.01 > Math.abs(aimXOld - aimX) && 0.01 > Math.abs(aimYOld - aimY))) {
                    aimXOld = aimX;
                    aimYOld = aimY;
                    var output = createBuffer(21);
                    output.setUint8(0, 16);
                    output.setFloat64(1, aimX, true);
                    output.setFloat64(9, aimY, true);
                    output.setUint32(17, 0, true);
                    socketWrite(output);
                }
            }
        }
    }
    function sendNick() {
        if (isSocketOpen() && null != nick) {
            var qwe5 = createBuffer(1 + 2 * nick.length);
            qwe5.setUint8(0, 0);
            var i = 0;
            for (; i < nick.length; ++i) {
                qwe5.setUint16(1 + 2 * i, nick.charCodeAt(i), true);
            }
            socketWrite(qwe5);
        }
    }
    function isSocketOpen() {
        return null != socket && socket.readyState == socket.OPEN;
    }
    function sendPacket(id) {
        if (isSocketOpen()) {
            var qwe6 = createBuffer(1);
            qwe6.setUint8(0, id);
            socketWrite(qwe6);
        }
    }
    function tick() {
        draw();
        win.requestAnimationFrame(tick);
    }
    function onResize() {
        width = win.innerWidth;
        height = win.innerHeight;
        cv.width = canvas.width = width;
        cv.height = canvas.height = height;
        var helloDialog = $("#helloDialog");
        helloDialog.css("transform", "none");
        var heightDialog = helloDialog.height();
        var heightWindow = win.innerHeight;
        if (heightDialog > heightWindow / 1.1) {
            helloDialog.css("transform", "translate(-50%, -50%) scale(" + heightWindow / heightDialog / 1.1 + ")");
        } else {
            helloDialog.css("transform", "translate(-50%, -50%)");
        }
        draw();
    }
    function unitRatio() {
        return Math.max(height / 1080, width / 1920) * zoom;
    }
    function updateRatio() {
        if (0 != playerGroup.length) {
            var size = 0;
            var i = 0;
            for (; i < playerGroup.length; i++) {
                size += playerGroup[i].size;
            }
            size = Math.pow(Math.min(64 / size, 1), 0.4) * unitRatio();
            ratio = (9 * ratio + size) / 10;
        }
    }
    function draw() {
        var playerHeight;
        var timestamp = Date.now();
        ++qweB;
        timestampLastDraw = timestamp;
        if (0 < playerGroup.length) {
            updateRatio();
            var playerWidth = playerHeight = 0;
            var i = 0;
            for (; i < playerGroup.length; i++) {
                playerGroup[i].updatePos();
                playerHeight += playerGroup[i].x / playerGroup.length;
                playerWidth += playerGroup[i].y / playerGroup.length;
            }
            middleX = playerHeight;
            middleY = playerWidth;
            chunk = ratio;
            offsetX = (offsetX + playerHeight) / 2;
            offsetY = (offsetY + playerWidth) / 2;
        } else {
            offsetX = (29 * offsetX + middleX) / 30;
            offsetY = (29 * offsetY + middleY) / 30;
            ratio = (9 * ratio + chunk * unitRatio()) / 10;
        }
        update();
        updateMouseAim();
        if (!isAcidMode) {
            ctx.clearRect(0, 0, width, height);
        }
        if (isAcidMode) {
            ctx.fillStyle = isDarkTheme ? "#111111" : "#F2FBFF";
            ctx.globalAlpha = 0.05;
            ctx.fillRect(0, 0, width, height);
            ctx.globalAlpha = 1;
        } else {
            drawGrid();
        }
        list.sort(function(a, b) {
            return a.size == b.size ? a.id - b.id : a.size - b.size;
        });
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(ratio, ratio);
        ctx.translate(-offsetX, -offsetY);
        if (isShowBorders) { //XXX
            drawBorders(ctx);
        }
        myMass = Math.min.apply(null, playerGroup.map(function(r) { //XXX
            return r.getMass();
        }));
        i = 0;
        for (; i < sprites.length; i++) {
            sprites[i].draw(ctx);
        }
        i = 0;
        for (; i < list.length; i++) {
            list[i].draw(ctx);
        }
        if (isTargeting) {
            targetBufferX = (3 * targetBufferX + targetX) / 4;
            targetBufferY = (3 * targetBufferY + targetY) / 4;
            ctx.save();
            ctx.strokeStyle = "#FFAAAA";
            ctx.lineWidth = 10;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            i = 0;
            for (; i < playerGroup.length; i++) {
                ctx.moveTo(playerGroup[i].x, playerGroup[i].y);
                ctx.lineTo(targetBufferX, targetBufferY);
            }
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
        if (img) {
            if (img.width) {
                ctx.drawImage(img, width - img.width - 10, 10);
            }
        }
        score = Math.max(score, getScore());
        if (0 != score) {
            if (null == button) {
                button = new SVGPlotFunction(24, "#FFFFFF");
            }
            button.setValue("Score: " + ~~(score / 100));
            var buttonRender = button.render();
            var buttonWidth = buttonRender.width;
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = "#000000";
            ctx.fillRect(10, height - 10 - 24 - 10, buttonWidth + 10, 34);
            ctx.globalAlpha = 1;
            ctx.drawImage(buttonRender, 15, height - 10 - 24 - 5);
        }
        drawSplitButton();
        timestamp = Date.now() - timestamp;
        if (timestamp > 1E3 / 60) {
            renderDetail -= 0.01;
        } else {
            if (timestamp < 1E3 / 65) {
                renderDetail += 0.01;
            }
        }
        if (0.4 > renderDetail) {
            renderDetail = 0.4;
        }
        if (1 < renderDetail) {
            renderDetail = 1;
        }
    }
    function drawGrid() {
        ctx.fillStyle = isDarkTheme ? "#111111" : "#F2FBFF";
        ctx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.strokeStyle = isDarkTheme ? "#AAAAAA" : "#000000";
        ctx.globalAlpha = 0.2;
        ctx.scale(ratio, ratio);
        var gridOffsetX = width / ratio;
        var gridOffsetY = height / ratio;
        var y = -0.5 + (-offsetX + gridOffsetX / 2) % 50;
        for (; y < gridOffsetX; y += 50) {
            ctx.beginPath();
            ctx.moveTo(y, 0);
            ctx.lineTo(y, gridOffsetY);
            ctx.stroke();
        }
        y = -0.5 + (-offsetY + gridOffsetY / 2) % 50;
        for (; y < gridOffsetY; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(gridOffsetX, y);
            ctx.stroke();
        }
        ctx.restore();
    }
    function drawSplitButton() {
        if (isMobile && imageSplitButton.width) {
            var widthButton = width / 5;
            ctx.drawImage(imageSplitButton, 5, 5, widthButton, widthButton);
        }
    }
    function getScore() {
        var value = 0;
        var i = 0;
        for (; i < playerGroup.length; i++) {
            value += playerGroup[i].nSize * playerGroup[i].nSize;
        }
        return value;
    }
    function render() {
        img = null;
        if (null != angles || 0 != users.length) {
            if (null != angles || isNames) {
                img = document.createElement("canvas");
                var ctx = img.getContext("2d");
                var i = 60;
                i = null == angles ? i + 24 * users.length : i + 180;
                var qweU = Math.min(200, 0.3 * width) / 200;
                img.width = 200 * qweU;
                img.height = i * qweU;
                ctx.scale(qweU, qweU);
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = "#000000";
                ctx.fillRect(0, 0, 200, i);
                ctx.globalAlpha = 1;
                ctx.fillStyle = "#FFFFFF";
                var qweV = "Leaderboard";
                ctx.font = "30px Ubuntu";
                ctx.fillText(qweV, 100 - ctx.measureText(qweV).width / 2, 40);
                if (null == angles) {
                    ctx.font = "20px Ubuntu";
                    i = 0;
                    for (; i < users.length; ++i) {
                        qweV = users[i].name || "An unnamed cell";
                        if (!isNames) {
                            qweV = "An unnamed cell";
                        }
                        if (-1 != ids.indexOf(users[i].id)) {
                            if (playerGroup[0].name) {
                                qweV = playerGroup[0].name;
                            }
                            ctx.fillStyle = "#FFAAAA";
                        } else {
                            ctx.fillStyle = "#FFFFFF";
                        }
                        qweV = i + 1 + ". " + qweV;
                        ctx.fillText(qweV, 100 - ctx.measureText(qweV).width / 2, 70 + 24 * i);
                    }
                } else {
                    var qweW = 0;
                    i = 0;
                    for (; i < angles.length; ++i) {
                        var qweX = qweW + angles[i] * Math.PI * 2;
                        ctx.fillStyle = qweH[i + 1];
                        ctx.beginPath();
                        ctx.moveTo(100, 140);
                        ctx.arc(100, 140, 80, qweW, qweX, false);
                        ctx.fill();
                        qweW = qweX;
                    }
                }
            }
        }
    }
    function Blob(id, x, y, size, color, name) {
        this.id = id;
        this.oX = this.x = x;
        this.oY = this.y = y;
        this.oSize = this.size = size;
        this.color = color;
        this.points = [];
        this.pointsAcc = [];
        this.createPoints();
        this.setName(name);
    }
    function SVGPlotFunction(size, color, stroke, strokeColor) {
        if (size) {
            this._size = size;
        }
        if (color) {
            this._color = color;
        }
        this._stroke = !!stroke;
        if (strokeColor) {
            this._strokeColor = strokeColor;
        }
    }
    function drawBorders(ctx) { //XXX
        if (isDarkTheme) {
            ctx["strokeStyle"] = "#FFFFFF";
        }
        ctx.beginPath();
        ctx.moveTo(0, 0); //TODO use min/max X/Y
        ctx.lineTo(11180, 0);
        ctx.lineTo(11180, 11180);
        ctx.lineTo(0, 11180);
        ctx.lineTo(0, 0);
        ctx.stroke();
    }
    var protocol = win.location.protocol;
    var isSecure = "https:" == protocol;
    if (win.location.ancestorOrigins && (win.location.ancestorOrigins.length && "https://apps.facebook.com" != win.location.ancestorOrigins[0])) {
        win.top.location = "http://agar.io/";
    } else {
        var cv;
        var ctx;
        var canvas;
        var width;
        var height;
        var context = null;
        var socket = null;
        var offsetX = 0;
        var offsetY = 0;
        var ids = [];
        var playerGroup = [];
        var blobs = {};
        var list = [];
        var sprites = [];
        var users = [];
        var mouseX = 0;
        var mouseY = 0;
        var aimX = -1;
        var aimY = -1;
        var qweB = 0;
        var timestampLastDraw = 0;
        var nick = null;
        var minX = 0;
        var minY = 0;
        var maxX = 1E4;
        var maxY = 1E4;
        var ratio = 1;
        var region = null;
        var isSkins = true;
        var isNames = true;
        var isColorsOff = false;
        var qweA = false;
        var score = 0;
        var isDarkTheme = false;
        var isShowMass = true; //XXX
        var middleX = offsetX = ~~((minX + maxX) / 2);
        var middleY = offsetY = ~~((minY + maxY) / 2);
        var chunk = 1;
        var gameMode = "";
        var angles = null;
        var initialized = false;
        var isTargeting = false;
        var targetX = 0;
        var targetY = 0;
        var targetBufferX = 0;
        var targetBufferY = 0;
        var previousKey = 0;
        var qweH = ["#333333", "#FF3333", "#33FF33", "#3333FF"];
        var isAcidMode = false;
        var qwe11 = false;
        var zoom = 1;
        var isMobile = "ontouchstart" in win && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        var imageSplitButton = new Image;
        imageSplitButton.src = "img/split.png";
        var test_canvas = document.createElement("canvas");
        if ("undefined" == typeof console || ("undefined" == typeof DataView || ("undefined" == typeof WebSocket || (null == test_canvas || (null == test_canvas.getContext || null == win.localStorage))))) {
            alert("You browser does not support this game, we recommend you to use Firefox to play this");
        } else {
            var regions = null;
            win.setNick = function(input) {
                if (isSpectating) { //XXX
                    spectate();
                } else {
                    hide();
                    nick = input;
                }
                sendNick();
                score = 0;
            };
            win.setRegion = setRegion;
            win.setSkins = function(input) {
                isSkins = input;
                win.localStorage.checkSkins = !input;
            };
            win.setNames = function(input) {
                isNames = input;
                win.localStorage.checkNames = !input;
            };
            win.setDarkTheme = function(input) {
                isDarkTheme = input;
                win.localStorage.checkDarkTheme = input;
            };
            win.setColorsOff = function(input) {
                isColorsOff = input;
                win.localStorage.checkColorsOff = input;
            };
            win.setShowMass = function(input) {
                isShowMass = input;
                win.localStorage.checkShowMass = input;
            };
            win.spectate = function() {
                nick = null;
                sendPacket(1);
                hide();
            };
            win.setGameMode = function(input) {
                if (input != gameMode) {
                    gameMode = input;
                    connect();
                }
            };
            win.setAcid = function(input) {
                isAcidMode = input;
                win.localStorage.checkAcidMode = input;
            };
            if (null != win.localStorage) {
                if (null == win.localStorage.AB8) {
                    win.localStorage.AB8 = 0 + ~~(100 * Math.random());
                }
                previousKey = +win.localStorage.AB8;
                win.ABGroup = previousKey;
            }
            $.get(protocol + "//gc.agar.io", function(input) {
                var inputSplit = input.split(" ");
                var country = inputSplit[0];
                var state = inputSplit[1] || "";
                if (-1 == ["UA"].indexOf(country)) {
                    skins.push("ussr");
                }
                if (locationMap.hasOwnProperty(country)) {
                    if ("string" == typeof locationMap[country]) {
                        if (!region) {
                            setRegion(locationMap[country]);
                        }
                    } else {
                        if (locationMap[country].hasOwnProperty(state)) {
                            if (!region) {
                                setRegion(locationMap[country][state]);
                            }
                        }
                    }
                }
            }, "text");
            setTimeout(function() {}, 3E5);
            var locationMap = {
                AF: "JP-Tokyo",
                AX: "EU-London",
                AL: "EU-London",
                DZ: "EU-London",
                AS: "SG-Singapore",
                AD: "EU-London",
                AO: "EU-London",
                AI: "US-Atlanta",
                AG: "US-Atlanta",
                AR: "BR-Brazil",
                AM: "JP-Tokyo",
                AW: "US-Atlanta",
                AU: "SG-Singapore",
                AT: "EU-London",
                AZ: "JP-Tokyo",
                BS: "US-Atlanta",
                BH: "JP-Tokyo",
                BD: "JP-Tokyo",
                BB: "US-Atlanta",
                BY: "EU-London",
                BE: "EU-London",
                BZ: "US-Atlanta",
                BJ: "EU-London",
                BM: "US-Atlanta",
                BT: "JP-Tokyo",
                BO: "BR-Brazil",
                BQ: "US-Atlanta",
                BA: "EU-London",
                BW: "EU-London",
                BR: "BR-Brazil",
                IO: "JP-Tokyo",
                VG: "US-Atlanta",
                BN: "JP-Tokyo",
                BG: "EU-London",
                BF: "EU-London",
                BI: "EU-London",
                KH: "JP-Tokyo",
                CM: "EU-London",
                CA: "US-Atlanta",
                CV: "EU-London",
                KY: "US-Atlanta",
                CF: "EU-London",
                TD: "EU-London",
                CL: "BR-Brazil",
                CN: "CN-China",
                CX: "JP-Tokyo",
                CC: "JP-Tokyo",
                CO: "BR-Brazil",
                KM: "EU-London",
                CD: "EU-London",
                CG: "EU-London",
                CK: "SG-Singapore",
                CR: "US-Atlanta",
                CI: "EU-London",
                HR: "EU-London",
                CU: "US-Atlanta",
                CW: "US-Atlanta",
                CY: "JP-Tokyo",
                CZ: "EU-London",
                DK: "EU-London",
                DJ: "EU-London",
                DM: "US-Atlanta",
                DO: "US-Atlanta",
                EC: "BR-Brazil",
                EG: "EU-London",
                SV: "US-Atlanta",
                GQ: "EU-London",
                ER: "EU-London",
                EE: "EU-London",
                ET: "EU-London",
                FO: "EU-London",
                FK: "BR-Brazil",
                FJ: "SG-Singapore",
                FI: "EU-London",
                FR: "EU-London",
                GF: "BR-Brazil",
                PF: "SG-Singapore",
                GA: "EU-London",
                GM: "EU-London",
                GE: "JP-Tokyo",
                DE: "EU-London",
                GH: "EU-London",
                GI: "EU-London",
                GR: "EU-London",
                GL: "US-Atlanta",
                GD: "US-Atlanta",
                GP: "US-Atlanta",
                GU: "SG-Singapore",
                GT: "US-Atlanta",
                GG: "EU-London",
                GN: "EU-London",
                GW: "EU-London",
                GY: "BR-Brazil",
                HT: "US-Atlanta",
                VA: "EU-London",
                HN: "US-Atlanta",
                HK: "JP-Tokyo",
                HU: "EU-London",
                IS: "EU-London",
                IN: "JP-Tokyo",
                ID: "JP-Tokyo",
                IR: "JP-Tokyo",
                IQ: "JP-Tokyo",
                IE: "EU-London",
                IM: "EU-London",
                IL: "JP-Tokyo",
                IT: "EU-London",
                JM: "US-Atlanta",
                JP: "JP-Tokyo",
                JE: "EU-London",
                JO: "JP-Tokyo",
                KZ: "JP-Tokyo",
                KE: "EU-London",
                KI: "SG-Singapore",
                KP: "JP-Tokyo",
                KR: "JP-Tokyo",
                KW: "JP-Tokyo",
                KG: "JP-Tokyo",
                LA: "JP-Tokyo",
                LV: "EU-London",
                LB: "JP-Tokyo",
                LS: "EU-London",
                LR: "EU-London",
                LY: "EU-London",
                LI: "EU-London",
                LT: "EU-London",
                LU: "EU-London",
                MO: "JP-Tokyo",
                MK: "EU-London",
                MG: "EU-London",
                MW: "EU-London",
                MY: "JP-Tokyo",
                MV: "JP-Tokyo",
                ML: "EU-London",
                MT: "EU-London",
                MH: "SG-Singapore",
                MQ: "US-Atlanta",
                MR: "EU-London",
                MU: "EU-London",
                YT: "EU-London",
                MX: "US-Atlanta",
                FM: "SG-Singapore",
                MD: "EU-London",
                MC: "EU-London",
                MN: "JP-Tokyo",
                ME: "EU-London",
                MS: "US-Atlanta",
                MA: "EU-London",
                MZ: "EU-London",
                MM: "JP-Tokyo",
                NA: "EU-London",
                NR: "SG-Singapore",
                NP: "JP-Tokyo",
                NL: "EU-London",
                NC: "SG-Singapore",
                NZ: "SG-Singapore",
                NI: "US-Atlanta",
                NE: "EU-London",
                NG: "EU-London",
                NU: "SG-Singapore",
                NF: "SG-Singapore",
                MP: "SG-Singapore",
                NO: "EU-London",
                OM: "JP-Tokyo",
                PK: "JP-Tokyo",
                PW: "SG-Singapore",
                PS: "JP-Tokyo",
                PA: "US-Atlanta",
                PG: "SG-Singapore",
                PY: "BR-Brazil",
                PE: "BR-Brazil",
                PH: "JP-Tokyo",
                PN: "SG-Singapore",
                PL: "EU-London",
                PT: "EU-London",
                PR: "US-Atlanta",
                QA: "JP-Tokyo",
                RE: "EU-London",
                RO: "EU-London",
                RU: "RU-Russia",
                RW: "EU-London",
                BL: "US-Atlanta",
                SH: "EU-London",
                KN: "US-Atlanta",
                LC: "US-Atlanta",
                MF: "US-Atlanta",
                PM: "US-Atlanta",
                VC: "US-Atlanta",
                WS: "SG-Singapore",
                SM: "EU-London",
                ST: "EU-London",
                SA: "EU-London",
                SN: "EU-London",
                RS: "EU-London",
                SC: "EU-London",
                SL: "EU-London",
                SG: "JP-Tokyo",
                SX: "US-Atlanta",
                SK: "EU-London",
                SI: "EU-London",
                SB: "SG-Singapore",
                SO: "EU-London",
                ZA: "EU-London",
                SS: "EU-London",
                ES: "EU-London",
                LK: "JP-Tokyo",
                SD: "EU-London",
                SR: "BR-Brazil",
                SJ: "EU-London",
                SZ: "EU-London",
                SE: "EU-London",
                CH: "EU-London",
                SY: "EU-London",
                TW: "JP-Tokyo",
                TJ: "JP-Tokyo",
                TZ: "EU-London",
                TH: "JP-Tokyo",
                TL: "JP-Tokyo",
                TG: "EU-London",
                TK: "SG-Singapore",
                TO: "SG-Singapore",
                TT: "US-Atlanta",
                TN: "EU-London",
                TR: "TK-Turkey",
                TM: "JP-Tokyo",
                TC: "US-Atlanta",
                TV: "SG-Singapore",
                UG: "EU-London",
                UA: "EU-London",
                AE: "EU-London",
                GB: "EU-London",
                US: {
                    AL: "US-Atlanta",
                    AK: "US-Fremont",
                    AZ: "US-Fremont",
                    AR: "US-Atlanta",
                    CA: "US-Fremont",
                    CO: "US-Fremont",
                    CT: "US-Atlanta",
                    DE: "US-Atlanta",
                    FL: "US-Atlanta",
                    GA: "US-Atlanta",
                    HI: "US-Fremont",
                    ID: "US-Fremont",
                    IL: "US-Atlanta",
                    IN: "US-Atlanta",
                    IA: "US-Atlanta",
                    KS: "US-Atlanta",
                    KY: "US-Atlanta",
                    LA: "US-Atlanta",
                    ME: "US-Atlanta",
                    MD: "US-Atlanta",
                    MA: "US-Atlanta",
                    MI: "US-Atlanta",
                    MN: "US-Fremont",
                    MS: "US-Atlanta",
                    MO: "US-Atlanta",
                    MT: "US-Fremont",
                    NE: "US-Fremont",
                    NV: "US-Fremont",
                    NH: "US-Atlanta",
                    NJ: "US-Atlanta",
                    NM: "US-Fremont",
                    NY: "US-Atlanta",
                    NC: "US-Atlanta",
                    ND: "US-Fremont",
                    OH: "US-Atlanta",
                    OK: "US-Atlanta",
                    OR: "US-Fremont",
                    PA: "US-Atlanta",
                    RI: "US-Atlanta",
                    SC: "US-Atlanta",
                    SD: "US-Fremont",
                    TN: "US-Atlanta",
                    TX: "US-Atlanta",
                    UT: "US-Fremont",
                    VT: "US-Atlanta",
                    VA: "US-Atlanta",
                    WA: "US-Fremont",
                    WV: "US-Atlanta",
                    WI: "US-Atlanta",
                    WY: "US-Fremont",
                    DC: "US-Atlanta",
                    AS: "US-Atlanta",
                    GU: "US-Atlanta",
                    MP: "US-Atlanta",
                    PR: "US-Atlanta",
                    UM: "US-Atlanta",
                    VI: "US-Atlanta"
                },
                UM: "SG-Singapore",
                VI: "US-Atlanta",
                UY: "BR-Brazil",
                UZ: "JP-Tokyo",
                VU: "SG-Singapore",
                VE: "BR-Brazil",
                VN: "JP-Tokyo",
                WF: "SG-Singapore",
                EH: "EU-London",
                YE: "JP-Tokyo",
                ZM: "EU-London",
                ZW: "EU-London"
            };
            win.connect = open;
            var backoff = 500;
            var aimXOld = -1;
            var aimYOld = -1;
            var img = null;
            var renderDetail = 1;
            var button = null;
            var images = {};
            var skins = "poland;usa;china;russia;canada;australia;spain;brazil;germany;ukraine;france;sweden;chaplin;north korea;south korea;japan;united kingdom;earth;greece;latvia;lithuania;estonia;finland;norway;cia;maldivas;austria;nigeria;reddit;yaranaika;confederate;9gag;indiana;4chan;italy;bulgaria;tumblr;2ch.hk;hong kong;portugal;jamaica;german empire;mexico;sanik;switzerland;croatia;chile;indonesia;bangladesh;thailand;iran;iraq;peru;moon;botswana;bosnia;netherlands;european union;taiwan;pakistan;hungary;satanist;qing dynasty;matriarchy;patriarchy;feminism;ireland;texas;facepunch;prodota;cambodia;steam;piccolo;ea;india;kc;denmark;quebec;ayy lmao;sealand;bait;tsarist russia;origin;vinesauce;stalin;belgium;luxembourg;stussy;prussia;8ch;argentina;scotland;sir;romania;belarus;wojak;doge;nasa;byzantium;imperial japan;french kingdom;somalia;turkey;mars;pokerface;8;irs;receita federal;facebook;m'blob".split(";"); //XXX
            var qweI = ["8", "nasa"];
            var skinsSpecial = ["m'blob"];
            Blob.prototype = {
                id: 0,
                points: null,
                pointsAcc: null,
                name: null,
                nameCache: null,
                sizeCache: null,
                x: 0,
                y: 0,
                size: 0,
                oX: 0,
                oY: 0,
                oSize: 0,
                nX: 0,
                nY: 0,
                nSize: 0,
                flags: 0,
                updateTime: 0,
                updateCode: 0,
                drawTime: 0,
                destroyed: false,
                isVirus: false,
                isAgitated: false,
                wasSimpleDrawing: true,
                destroy: function() {
                    var i = 0;
                    for (; i < list.length; i++) {
                        if (list[i] == this) {
                            list.splice(i, 1);
                            break;
                        }
                    }
                    delete blobs[this.id];
                    i = playerGroup.indexOf(this);
                    if (-1 != i) {
                        qweA = true;
                        playerGroup.splice(i, 1);
                    }
                    i = ids.indexOf(this.id);
                    if (-1 != i) {
                        ids.splice(i, 1);
                    }
                    this.destroyed = true;
                    sprites.push(this);
                },
                getNameSize: function() {
                    if (isLargeNames) { //XXX
                        return 50 + 0.3 * this.size;
                    } else {
                        return Math.max(~~(0.3 * this.size), 24);
                    }
                },
                setName: function(name) {
                    if (this.name = name) {
                        if (null == this.nameCache) {
                            this.nameCache = new SVGPlotFunction(this.getNameSize(), "#FFFFFF", true, "#000000");
                        } else {
                            this.nameCache.setSize(this.getNameSize());
                        }
                        this.nameCache.setValue(this.name);
                    }
                },
                createPoints: function() {
                    var max = this.getNumPoints();
                    for (; this.points.length > max;) {
                        var qwe8 = ~~(Math.random() * this.points.length);
                        this.points.splice(qwe8, 1);
                        this.pointsAcc.splice(qwe8, 1);
                    }
                    if (0 == this.points.length) {
                        if (0 < max) {
                            this.points.push({
                                self: this,
                                size: this.size,
                                x: this.x,
                                y: this.y
                            });
                            this.pointsAcc.push(Math.random() - 0.5);
                        }
                    }
                    for (; this.points.length < max;) {
                        qwe8 = ~~(Math.random() * this.points.length);
                        var point = this.points[qwe8];
                        this.points.splice(qwe8, 0, {
                            self: this,
                            size: point.size,
                            x: point.x,
                            y: point.y
                        });
                        this.pointsAcc.splice(qwe8, 0, this.pointsAcc[qwe8]);
                    }
                },
                getNumPoints: function() {
                    if (0 == this.id) {
                        return 16;
                    }
                    var qwe9 = 10;
                    if (20 > this.size) {
                        qwe9 = 0;
                    }
                    if (this.isVirus) {
                        qwe9 = 30;
                    }
                    var qwe10 = this.size;
                    if (!this.isVirus) {
                        qwe10 *= ratio;
                    }
                    qwe10 *= renderDetail;
                    if (this.flags & 32) {
                        qwe10 *= 0.25;
                    }
                    return ~~Math.max(qwe10, qwe9);
                },
                movePoints: function() {
                    this.createPoints();
                    var points = this.points;
                    var pointsAcc = this.pointsAcc;
                    var numPoints = points.length;
                    var i = 0;
                    for (; i < numPoints; ++i) {
                        var qweL = pointsAcc[(i - 1 + numPoints) % numPoints];
                        var qweM = pointsAcc[(i + 1) % numPoints];
                        pointsAcc[i] += (Math.random() - 0.5) * (this.isAgitated ? 3 : 1);
                        pointsAcc[i] *= 0.7;
                        if (10 < pointsAcc[i]) {
                            pointsAcc[i] = 10;
                        }
                        if (-10 > pointsAcc[i]) {
                            pointsAcc[i] = -10;
                        }
                        pointsAcc[i] = (qweL + qweM + 8 * pointsAcc[i]) / 10;
                    }
                    var qweK = this;
                    var qweO = 0;
                    if (!this.isVirus) {
                        qweO = (this.id / 1E3 + timestampLastDraw / 1E4) % (2 * Math.PI);
                    }
                    i = 0;
                    for (; i < numPoints; ++i) {
                        var size = points[i].size;
                        qweL = points[(i - 1 + numPoints) % numPoints].size;
                        qweM = points[(i + 1) % numPoints].size;
                        if (15 < this.size && (null != context && (20 < this.size * ratio && 0 != this.id))) {
                            var qweN = false;
                            var startX = points[i].x;
                            var startY = points[i].y;
                            context.retrieve2(startX - 5, startY - 5, 10, 10, function(data) {
                                if (data.self != qweK) {
                                    if (25 > (startX - data.x) * (startX - data.x) + (startY - data.y) * (startY - data.y)) {
                                        qweN = true;
                                    }
                                }
                            });
                            if (!qweN) {
                                if (points[i].x < minX || (points[i].y < minY || (points[i].x > maxX || points[i].y > maxY))) {
                                    qweN = true;
                                }
                            }
                            if (qweN) {
                                if (0 < pointsAcc[i]) {
                                    pointsAcc[i] = 0;
                                }
                                pointsAcc[i] -= 1;
                            }
                        }
                        size += pointsAcc[i];
                        if (0 > size) {
                            size = 0;
                        }
                        size = this.isAgitated ? (19 * size + this.size) / 20 : (12 * size + this.size) / 13;
                        points[i].size = (qweL + qweM + 8 * size) / 10;
                        qweL = 2 * Math.PI / numPoints;
                        qweM = this.points[i].size;
                        if (this.isVirus) {
                            if (0 == i % 2) {
                                qweM += 5;
                            }
                        }
                        points[i].x = this.x + Math.cos(qweL * i + qweO) * qweM;
                        points[i].y = this.y + Math.sin(qweL * i + qweO) * qweM;
                    }
                },
                updatePos: function() {
                    if (0 == this.id) {
                        return 1;
                    }
                    var ratio = (timestampLastDraw - this.updateTime) / 120;
                    if (0 > ratio) {
                        ratio = 0;
                    } else {
                        if (1 < ratio) {
                            ratio = 1;
                        }
                    }
                    this.getNameSize();
                    if (this.destroyed && 1 <= ratio) {
                        var index = sprites.indexOf(this);
                        if (-1 != index) {
                            sprites.splice(index, 1);
                        }
                    }
                    this.x = ratio * (this.nX - this.oX) + this.oX;
                    this.y = ratio * (this.nY - this.oY) + this.oY;
                    this.size = ratio * (this.nSize - this.oSize) + this.oSize;
                    return ratio;
                },
                shouldRender: function() {
                    if (0 == this.id) {
                        return true;
                    }
                    if (this.x + this.size + 40 < offsetX - width / 2 / ratio || (this.y + this.size + 40 < offsetY - height / 2 / ratio || (this.x - this.size - 40 > offsetX + width / 2 / ratio || this.y - this.size - 40 > offsetY + height / 2 / ratio))) {
                        return false;
                    }
                    return true;
                },
                getMass: function() {
                    return ~~(this.size * this.size / 100);
                },
                draw: function(ctx) {
                    if (this.shouldRender()) {
                        var color = this.color; //XXX
                        if (isInteractiveColors && (!isSpectating && this.size > 20)) { //XXX
                            var thisMass = this.getMass();
                            if (playerGroup.length === 0) {
                                color = this.color;
                            } else if (this.isVirus) {
                                if (this.getMass() > 220) {
                                    color = "#300A48";
                                } else {
                                    color = "#A020F0";
                                }
                            } else if (~playerGroup.indexOf(this)) {
                                color = "#3371FF";
                            } else if (thisMass > 1.3 * myMass * 2) {
                                color = "#FF3C3C";
                            } else if (thisMass > 1.3 * myMass) {
                                color = "#FFBF3D";
                            } else if (1.3 * thisMass * 2 < myMass) {
                                color = "#44F720";
                            } else if (1.3 * thisMass < myMass) {
                                color = "#00AA00";
                            } else {
                                color = "#FFFF00";
                            }
                        }
                        var isSimpleDrawing = isSimpleMode || (this.size < 20 && !isColorsOff); //XXX
                        if (5 > this.getNumPoints()) {
                            isSimpleDrawing = true;
                        }
                        if (this.wasSimpleDrawing && !isSimpleDrawing) {
                            var i = 0;
                            for (; i < this.points.length; i++) {
                                this.points[i].size = this.size;
                            }
                        }
                        this.wasSimpleDrawing = isSimpleDrawing;
                        ctx.save();
                        this.drawTime = timestampLastDraw;
                        var updatePos = this.updatePos();
                        if (this.destroyed) {
                            ctx.globalAlpha *= 1 - updatePos;
                        }
                        ctx.lineWidth = isLargeBlobBorders ? 30 : 10; //XXX
                        ctx.lineCap = "round";
                        ctx.lineJoin = this.isVirus ? "miter" : "round";
                        if (isColorsOff) {
                            ctx.fillStyle = "#FFFFFF";
                            ctx.strokeStyle = "#AAAAAA";
                        } else {
                            if (":teams" == gameMode && !this.isVirus) { //XXX
                                ctx.fillStyle = this.color;
                            } else {
                                ctx.fillStyle = color;
                            }
                            ctx.strokeStyle = color; //XXX
                        }
                        if (isVirusTransparent && this.isVirus) { //XXX
                            ctx.globalAlpha = 0.6;
                        }
                        if (isSimpleDrawing) {
                            ctx.beginPath();
                            ctx.arc(this.x, this.y, this.size + 5, 0, 2 * Math.PI, false);
                        } else {
                            this.movePoints();
                            ctx.beginPath();
                            var numPoints = this.getNumPoints();
                            ctx.moveTo(this.points[0].x, this.points[0].y);
                            var i = 1;
                            for (; i <= numPoints; ++i) {
                                var j = i % numPoints;
                                ctx.lineTo(this.points[j].x, this.points[j].y);
                            }
                        }
                        ctx.closePath();
                        var name = this.name.toLowerCase();
                        var nameImg = null;
                        if (!this.isAgitated && isSkins) { //XXX
                            if (-1 != skins.indexOf(name)) {
                                if (!images.hasOwnProperty(name)) {
                                    images[name] = new Image;
                                    images[name].src = "skins/" + name + ".png";
                                }
                                if (0 != images[name].width && images[name].complete) {
                                    nameImg = images[name];
                                }
                            }
                        }
                        var isSkinSpecial = -1 != skinsSpecial.indexOf(name);
                        if (!isSimpleDrawing) {
                            ctx.stroke();
                        }
                        ctx.fill();
                        if (!(null == nameImg)) {
                            if (!isSkinSpecial) {
                                ctx.save();
                                ctx.clip();
                                if (isTransparent || ":teams" == gameMode) { //XXX
                                    ctx.globalAlpha = 0.6;
                                }
                                ctx.drawImage(nameImg, this.x - this.size, this.y - this.size, 2 * this.size, 2 * this.size);
                                ctx.restore();
                            }
                        }
                        if (isColorsOff || 15 < this.size) {
                            if (!isSimpleDrawing) {
                                ctx.strokeStyle = "#000000";
                                ctx.globalAlpha *= 0.1;
                                ctx.stroke();
                            }
                        }
                        ctx.globalAlpha = 1;
                        if (null != nameImg) {
                            if (isSkinSpecial) {
                                if (isTransparent || ":teams" == gameMode) { //XXX
                                    ctx.globalAlpha = 0.6;
                                }
                                ctx.drawImage(nameImg, this.x - 2 * this.size, this.y - 2 * this.size, 4 * this.size, 4 * this.size);
                            }
                        }
                        ctx.globalAlpha = 1; //XXX
                        var isPlayer = -1 != playerGroup.indexOf(this);
                        if (0 != this.id) {
                            isSimpleDrawing = ~~this.y;
                            if ((isNames || isPlayer) && (this.name && (this.nameCache && (null == nameImg || -1 == qweI.indexOf(name))))) {
                                var namePlot = this.nameCache;
                                namePlot.setValue(this.name);
                                namePlot.setSize(this.getNameSize());
                                var nameScale = Math.ceil(10 * ratio) / 10;
                                namePlot.setScale(nameScale);
                                var nameRender = namePlot.render();
                                var qweY = ~~(nameRender.width / nameScale);
                                var qweP = ~~(nameRender.height / nameScale);
                                ctx.drawImage(nameRender, ~~this.x - ~~(qweY / 2), isSimpleDrawing - ~~(qweP / 2), qweY, qweP);
                                isSimpleDrawing += nameRender.height / 2 / nameScale + 4;
                            }
                            if (isShowMass) {
                                if (isPlayer || 20 < this.size) { //XXX
                                    if (null == this.sizeCache) {
                                        this.sizeCache = new SVGPlotFunction(this.getNameSize() / 2, "#FFFFFF", true, "#000000");
                                    }
                                    var sizePlot = this.sizeCache;
                                    sizePlot.setSize(this.getNameSize() / 2);
                                    sizePlot.setValue(~~(this.size * this.size / 100));
                                    var sizeScale = Math.ceil(10 * ratio) / 10;
                                    sizePlot.setScale(sizeScale);
                                    var sizeRender = sizePlot.render();
                                    qweY = ~~(sizeRender.width / sizeScale);
                                    qweP = ~~(sizeRender.height / sizeScale);
                                    ctx.drawImage(sizeRender, ~~this.x - ~~(qweY / 2), isSimpleDrawing - ~~(qweP / 2), qweY, qweP);
                                }
                            }
                        }
                        ctx.restore();
                    }
                }
            };
            SVGPlotFunction.prototype = {
                _value: "",
                _color: "#000000",
                _stroke: false,
                _strokeColor: "#000000",
                _size: 16,
                _canvas: null,
                _ctx: null,
                _dirty: false,
                _scale: 1,
                setSize: function(size) {
                    if (this._size != size) {
                        this._size = size;
                        this._dirty = true;
                    }
                },
                setScale: function(scale) {
                    if (this._scale != scale) {
                        this._scale = scale;
                        this._dirty = true;
                    }
                },
                setStrokeColor: function(color) {
                    if (this._strokeColor != color) {
                        this._strokeColor = color;
                        this._dirty = true;
                    }
                },
                setValue: function(value) {
                    if (value != this._value) {
                        this._value = value;
                        this._dirty = true;
                    }
                },
                render: function() {
                    if (null == this._canvas) {
                        this._canvas = document.createElement("canvas");
                        this._ctx = this._canvas.getContext("2d");
                    }
                    if (this._dirty) {
                        this._dirty = false;
                        var canvas = this._canvas;
                        var ctx = this._ctx;
                        var caracter = this._value;
                        var scale = this._scale;
                        var size = this._size;
                        var text = size + "px Ubuntu";
                        ctx.font = text;
                        var height = ~~(0.2 * size);
                        canvas.width = (ctx.measureText(caracter).width + 6) * scale;
                        canvas.height = (size + height) * scale;
                        ctx.font = text;
                        ctx.scale(scale, scale);
                        ctx.globalAlpha = 1;
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = this._strokeColor;
                        ctx.fillStyle = this._color;
                        if (this._stroke) {
                            ctx.strokeText(caracter, 3, size - height / 2);
                        }
                        ctx.fillText(caracter, 3, size - height / 2);
                    }
                    return this._canvas;
                }
            };
            if (!Date.now) {
                Date.now = function() {
                    return (new Date).getTime();
                };
            }
            var path = {
                init: function(args) {
                    function Node(x, y, w, h, depth) {
                        this.x = x;
                        this.y = y;
                        this.w = w;
                        this.h = h;
                        this.depth = depth;
                        this.items = [];
                        this.nodes = [];
                    }
                    var TOP_LEFT = 0;
                    var TOP_RIGHT = 1;
                    var BOTTOM_LEFT = 2;
                    var BOTTOM_RIGHT = 3;
                    var maxChildren = args.maxChildren || 2;
                    var maxDepth = args.maxDepth || 4;
                    Node.prototype = {
                        x: 0,
                        y: 0,
                        w: 0,
                        h: 0,
                        depth: 0,
                        items: null,
                        nodes: null,
                        exists: function(selector) {
                            var i = 0;
                            for (; i < this.items.length; ++i) {
                                var item = this.items[i];
                                if (item.x >= selector.x && (item.y >= selector.y && (item.x < selector.x + selector.w && item.y < selector.y + selector.h))) {
                                    return true;
                                }
                            }
                            if (0 != this.nodes.length) {
                                var self = this;
                                return this.findOverlappingNodes(selector, function(dir) {
                                    return self.nodes[dir].exists(selector);
                                });
                            }
                            return false;
                        },
                        retrieve: function(item, callback) {
                            var i = 0;
                            for (; i < this.items.length; ++i) {
                                callback(this.items[i]);
                            }
                            if (0 != this.nodes.length) {
                                var self = this;
                                this.findOverlappingNodes(item, function(dir) {
                                    self.nodes[dir].retrieve(item, callback);
                                });
                            }
                        },
                        insert: function(item) {
                            if (0 != this.nodes.length) {
                                this.nodes[this.findInsertNode(item)].insert(item);
                            } else {
                                if (this.items.length >= maxChildren && this.depth < maxDepth) {
                                    this.divide();
                                    this.nodes[this.findInsertNode(item)].insert(item);
                                } else {
                                    this.items.push(item);
                                }
                            }
                        },
                        findInsertNode: function(item) {
                            if (item.x < this.x + this.w / 2) {
                                if (item.y < this.y + this.h / 2) {
                                    return TOP_LEFT;
                                }
                                return BOTTOM_LEFT;
                            }
                            if (item.y < this.y + this.h / 2) {
                                return TOP_RIGHT;
                            }
                            return BOTTOM_RIGHT;
                        },
                        findOverlappingNodes: function(item, callback) {
                            if (item.x < this.x + this.w / 2) {
                                if (item.y < this.y + this.h / 2) {
                                    if (callback(TOP_LEFT)) {
                                        return true;
                                    }
                                }
                                if (item.y >= this.y + this.h / 2) {
                                    if (callback(BOTTOM_LEFT)) {
                                        return true;
                                    }
                                }
                            }
                            if (item.x >= this.x + this.w / 2) {
                                if (item.y < this.y + this.h / 2) {
                                    if (callback(TOP_RIGHT)) {
                                        return true;
                                    }
                                }
                                if (item.y >= this.y + this.h / 2) {
                                    if (callback(BOTTOM_RIGHT)) {
                                        return true;
                                    }
                                }
                            }
                            return false;
                        },
                        divide: function() {
                            var childrenDepth = this.depth + 1;
                            var width = this.w / 2;
                            var height = this.h / 2;
                            this.nodes.push(new Node(this.x, this.y, width, height, childrenDepth));
                            this.nodes.push(new Node(this.x + width, this.y, width, height, childrenDepth));
                            this.nodes.push(new Node(this.x, this.y + height, width, height, childrenDepth));
                            this.nodes.push(new Node(this.x + width, this.y + height, width, height, childrenDepth));
                            var oldChildren = this.items;
                            this.items = [];
                            var i = 0;
                            for (; i < oldChildren.length; i++) {
                                this.insert(oldChildren[i]);
                            }
                        },
                        clear: function() {
                            var i = 0;
                            for (; i < this.nodes.length; i++) {
                                this.nodes[i].clear();
                            }
                            this.items.length = 0;
                            this.nodes.length = 0;
                        }
                    };
                    var internalSelector = {
                        x: 0,
                        y: 0,
                        w: 0,
                        h: 0
                    };
                    return {
                        root: function() {
                            return new Node(args.minX, args.minY, args.maxX - args.minX, args.maxY - args.minY, 0);
                        }(),
                        insert: function(item) {
                            this.root.insert(item);
                        },
                        retrieve: function(selector, callback) {
                            this.root.retrieve(selector, callback);
                        },
                        retrieve2: function(x, y, w, h, callback) {
                            internalSelector.x = x;
                            internalSelector.y = y;
                            internalSelector.w = w;
                            internalSelector.h = h;
                            this.root.retrieve(internalSelector, callback);
                        },
                        exists: function(x) {
                            return this.root.exists(x);
                        },
                        clear: function() {
                            this.root.clear();
                        }
                    };
                }
            };
            $(function() {
                function draw() {
                    if (0 < playerGroup.length) {
                        self.color = playerGroup[0].color;
                        self.setName(playerGroup[0].name);
                    }
                    c.clearRect(0, 0, 32, 32);
                    c.save();
                    c.translate(16, 16);
                    c.scale(0.4, 0.4);
                    self.draw(c);
                    c.restore();
                    ++e;
                    e %= 10;
                    if (0 == e) {
                        var originalFavicon = document.getElementById("favicon");
                        var newNode = originalFavicon.cloneNode(true);
                        newNode.setAttribute("href", canvas.toDataURL("image/png"));
                        originalFavicon.parentNode.replaceChild(newNode, originalFavicon);
                    }
                }
                var self = new Blob(0, 0, 0, 32, "#ED1C24", "");
                var canvas = document.createElement("canvas");
                canvas.width = 32;
                canvas.height = 32;
                var c = canvas.getContext("2d");
                var e = 0;
                draw();
                setInterval(draw, 1E3 / 60);
            });
            self.setShowBorders = function(input) {
                isShowBorders = input;
                win.localStorage.checkShowBorders = input;
            };
            self.setUnlimitedZoom = function(input) {
                isUnlimitedZoom = input;
                win.localStorage.checkUnlimitedZoom = input;
            };
            self.setInteractiveColors = function(input) {
                isInteractiveColors = input;
                win.localStorage.checkInteractiveColors = input;
            };
            self.setTransparent = function(input) {
                isTransparent = input;
                win.localStorage.checkTransparent = input;
            };
            self.setLargeNames = function(input) {
                isLargeNames = input;
                win.localStorage.checkLargeNames = input;
            };
            self.setSpectate = function(input) {
                isSpectating = input;
                win.localStorage.checkSpectate = input;
                if (isSpectating) {
                    $("#playBtn").html("Spectate");
                    $("#playBtn").addClass("btn-warning");
                    $("#playBtn").removeClass("btn-primary");
                } else {
                    $("#playBtn").html("Play");
                    $("#playBtn").addClass("btn-primary");
                    $("#playBtn").removeClass("btn-warning");
                }
            };
            self.setLargeBlobBorders = function(input) {
                isLargeBlobBorders = input;
                win.localStorage.checkLargeBlobBorders = input;
            };
            self.setVirusTransparent = function(input) {
                isVirusTransparent = input;
                win.localStorage.checkVirusTransparent = input;
            };
            self.setSimpleMode = function(input) {
                isSimpleMode = input;
                win.localStorage.checkSimpleMode = input;
            };
            self.serverConnectBtn = function() {
                if ($("#server_ip").val()) {
                    open($("#server_ip").val(),$("#server_token").val());
                }
            };
            self.nicksChange = function() {
                var name = $("#nicks").children("option").filter(":selected").text();
                $("#nick").val(name);
                if (-1 != skins.indexOf(name)) {
                    $("#preview").attr("src", "skins/" + name + ".png");
                }
            };
            win.onload = init;
        }
        var isShowBorders = true;
        var isUnlimitedZoom = true;
        var isInteractiveColors = true;
        var isSpectating = false;
        var isTransparent = false;
        var isLargeNames = false;
        var isLargeBlobBorders = false;
        var isVirusTransparent = true;
        var isSimpleMode = false;
        var myMass = 0;
    }
})(window, window.jQuery);
