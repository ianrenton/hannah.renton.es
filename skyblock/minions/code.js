// Static defines
var DOMAIN = "https://api.hypixel.net";
var KEY = "7a55e11f-9484-4773-af11-69295c39157c";
var REJECTED_ITEMS = ["BLOCK", "COMPACTOR", "SILK", "TOOTH", "REVENANT", "FRAGMENT"];
var lastRefresh = new Date(0);

// Globals
var prices = {};
var actionTime = 10;
var itemsPerAction = 1;
var sortByPrice = true;

// Basic API request function
function request(endpoint, params, callback) {
	params["key"] = KEY;
	var url = DOMAIN + endpoint + "?" + encodeQueryData(params);
	$.getJSON(url, callback);
}

// Encode query data function
function encodeQueryData(data) {
   const ret = [];
   for (let d in data)
     ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
   return ret.join('&');
}

// Main method to get product list
function getProductList() {
	request("/skyblock/bazaar/products", {}, async function(result) {
		// Store refresh date
		lastRefresh = new Date();

		var productIds = result.productIds;
		// Reject things minions can't make
		productIds = productIds.filter(filter);

		// Iterate over all products
		for (var i = 0; i < productIds.length; i++) {
			await new Promise(r => setTimeout(r, 100));
			var id = productIds[i];

			// Query unit price
			request("/skyblock/bazaar/product", { "productId": id }, handleStats);
		}
	});
}

// Callback handler for specific item stats
async function handleStats(result) {
	if (result.success) {
		// Success, put stuff in the list
		var id = result.product_info.product_id;
		var buyPrice = result.product_info.quick_status.buyPrice
		prices[id] = buyPrice;
		storeData();
		updateDisplay();
	} else {
		// Failed, request another go
		await new Promise(r => setTimeout(r, 100));
		request("/skyblock/bazaar/product", { "productId": id }, handleStats);
	}
}

// Prettify item name function
function prettify(string) {
	var result;
	var sentence = string.toLowerCase().split("_");
	for(var i = 0; i< sentence.length; i++){
		sentence[i] = sentence[i][0].toUpperCase() + sentence[i].slice(1);
	}
	result = sentence.join(" ");
	result = result.replace(":", " : ");
	result = result.replace(" Item", "");
	return result;
}

// Sort function, by price or by name
function sort(unordered) {
	const ordered = {};

	if (sortByPrice) {
		// Sorting by price
		var sortable = [];
		for (var e in unordered) {
		    sortable.push([e, unordered[e]]);
		}
		sortable.sort(function(a, b) {
		    return b[1] - a[1];
		});
		sortable.forEach(function(e){
		    ordered[e[0]]=e[1];
		});
	} else {
		// Sorting by name
		Object.keys(unordered).sort().forEach(function(key) {
		  ordered[key] = unordered[key];
		});
	}
	return ordered;
}

// Item filter function, rejects items that minions can't make
function filter(value) {
  return REJECTED_ITEMS.every(function(v) {
    return value.indexOf(v) == -1;
  });
}

// Store API data in Local Storage so it can be loaded on page refresh
// without querying the API again
function storeData() {
	window.localStorage.setItem('bazaarPrices', JSON.stringify(prices));
	window.localStorage.setItem('bazaarPricesLastUpdate', lastRefresh);
}

// Restore API data from Local Storage so it can be used
// without querying the API again
function restoreData() {
	if (localStorage.getItem('bazaarPrices') === null) {
		// No local stored data, trigger API calls
		getProductList();
	} else {
		// Load local storage data
		prices = JSON.parse(window.localStorage.getItem('bazaarPrices'));
		var lastRefreshStr = window.localStorage.getItem('bazaarPricesLastUpdate');
		lastRefresh = new Date(lastRefreshStr);
		updateDisplay();
	}
}

// UI update function
function updateDisplay() {
	$("#dataAge").text(moment(lastRefresh).fromNow());

	var table = $('<table>').addClass('results');
	var header = $('<tr>').html("<th>Item</th><th>Bazaar Buy Price</th><th>Revenue per Day</th>");
	table.append(header);

	for (id in sort(prices)) {
		var itemName = prettify(id);
		var price1DPL = Math.round(prices[id] * 10.0) / 10.0;
		var calcResult = Math.round(calcRevenuePerDay(prices[id], id.includes("ENCHANTED")));
	    var row = $('<tr>').html("<td>" + itemName + "</td><td>" + price1DPL + "</td><td>" + calcResult + "</td>");
	    table.append(row);
	}

	$('#table').html(table);
}

// Calculation function
function calcRevenuePerDay(unitPrice, enchanted) {
	var calc = (86400 / actionTime * itemsPerAction * unitPrice);
	if (enchanted) {
		calc = calc / 160;
	}
	return calc + (138240 / actionTime);
}

// Run on startup:

// Set UI to match internal values
$('#actionTime').val(actionTime);
$('#itemsPerAction').val(itemsPerAction);

// Bind UI inputs to set internal values and update UI
$('#actionTime').keyup(function() {
    actionTime = $( this ).val();
    updateDisplay();
});
$('#itemsPerAction').keyup(function() {
    itemsPerAction = $( this ).val();
    updateDisplay();
});
$('input.sortBy').on('change', function() {
	sortByPrice = $('input#sortByPrice').is(":checked");
	updateDisplay();
});
$('button#refresh').click(function() {
	getProductList();
});

// Restore from local storage. If no data exists in local storage,
// a refresh will be triggered.
restoreData();
