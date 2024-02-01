export function isJson(str) {
    let json;
  try {
    json = JSON.parse(str);
  } catch (e) {
    return undefined;
  }  
  return json;
}

export function isNa(target) {
    if (target === undefined || target === 'undefined' || target === '' || target === null) {
        return true
    }
    return false;
}

async function showWarr(warr = null, response = null) {
    clearTimeout(global_warr_timer);
    var time = 2000;
    //show error message;
    $("#status_message").removeClass(["white", "red", "green", "blue", "orange"]);
    switch (warr) {
        case "error":
            time = 10000;
            $("#status_message").addClass("red");
            $("#warr_message").html('<i class="fa-solid fa-triangle-exclamation"></i>' + ' ' + "Error: " + response);
            break;
        case "required_value":
            $("#status_message").addClass("orange");
            $("#warr_message").html('<i class="fa-solid fa-fingerprint"></i>' + ' ' + "Required: " + response);
            break;
        case "connect":
            time = null;
            $("#status_message").addClass("white");
            $("#warr_message").html('<i class="fa-solid fa-cloud"></i>' + ' ' + "Connecting to " + localStorage.getItem('_host') + ":" + localStorage.getItem('_port'));
            break;
        case "connected":
            $("#status_message").addClass("green");
            $("#warr_message").html('<i class="fa-solid fa-cloud"></i>' + ' ' + "Connected" + localStorage.getItem('_host') + ":" + localStorage.getItem('_port'));
            break;
        case "disconnected":
            time = 3000;
            $("#status_message").addClass("red");
            $("#warr_message").html('<i class="fa-solid fa-cloud"></i> Connection failed to ' + localStorage.getItem('_host') + ":" + localStorage.getItem('_port'));
            break;
        case "authenticated":
            $("#status_message").addClass("green");
            $("#warr_message").html('<i class="fa-solid fa-fingerprint"></i> Connection estabslished');
            break;
        case "login_wrong_credentials":
            $("#status_message").addClass("red");
            $("#warr_message").html('<i class="fa-solid fa-fingerprint"></i>' + ' ' + "Wrong credentials");
            break;
        case "observe_mode":
            $("#status_message").addClass("blue");
            $("#warr_message").html('<i class="fa-solid fa-lock"></i>' + ' ' + "Interface is locked");
            break;
        case "safe_mode":
            if (response == 'enabled') {
                $("#status_message").addClass("green");
            } else {
                $("#status_message").addClass("red");
            }
            $("#warr_message").html('<i class="fa-solid fa-lock"></i>' + ' ' + "Safe mode " + response);
            break;
        case "follow_mode":
            if (response == 'enabled') {
                $("#status_message").addClass("red");
            } else {
                $("#status_message").addClass("white");
            }
            $("#warr_message").html('<i class="fa-solid fa-link"></i>' + ' ' + "Follow mode " + response);
            break;
        default:
            $("#status_message").addClass("white");
            if (isNa(warr)) {
                warr = '';
            }
            $("#warr_message").html(warr + ' ' + response);
    }
    $("body").addClass("show_warr");
    if (time != null) {
        global_warr_timer = setTimeout(warrDismiss, time);
    }
    return false;
}