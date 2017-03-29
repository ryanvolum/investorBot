require('./connectorSetup.js')();
var https = require('https');
var request = require('request');


bot.dialog('promptButtons', [
    (session) => {
        builder.Prompts.choice(session, "Pick one", ['Buy Stock', 'Sell Stock', 'Check Investment Status', 'Lookup Stock'], { listStyle: builder.ListStyle.button });
    },
    (session, results) => {
        switch (results.response.entity) {
            case "Buy Stock":
                session.replaceDialog('buyStock');
                break;
            case "Check Investment Status":
                session.replaceDialog('checkStocks');
                break;
            case "Sell Stock":
                session.replaceDialog('sellStock');
                break;
            case "Lookup Stock":
                session.replaceDialog("lookupStock");
                break;
        }
    }
])

bot.dialog("buyStock", [
    (session) => {
        builder.Prompts.text(session, "What stock (ticker symbol) would you like to buy?");
    },
    (session, results) => {
        var ticker = results.response;
        getStockInfo(ticker, (stockInfo, error) => {
            if (stockInfo && stockInfo.LastPrice && stockInfo.Name && !error) {
                session.dialogData.currentStockInfo = stockInfo;
                builder.Prompts.number(session, "The current price of " + stockInfo.Name + " is " + stockInfo.LastPrice + ". How much ya lookin' to buy?")
            } else {
                session.endDialog("Hmm I'm not sure that's a real ticker symbol. Either I'm broken or that's not an actual ticker symbol...")
            }
        })
    },
    (session, results) => {
        var stockQuantity = results.response;
        if (stockQuantity > 0) {
            //Note: Potential vulnerability - we should re-call the price API before we make purchases. 
            var purchasePrice = stockQuantity * session.dialogData.currentStockInfo.LastPrice;
            if (isPurchasable(session, purchasePrice)) {
                addStocks(session, stockQuantity);
                session.privateConversationData.cash -= purchasePrice;
                session.endDialog("Congrats! You just bought yourself " + stockQuantity + " units of " + session.dialogData.currentStockInfo.Name + " stock. You've got $" + session.privateConversationData.cash + " left over.")
            } else {
                session.endDialog("You don't have enough money to buy that amount of stock. " + stockQuantity + " shares of " + session.dialogData.stockInfo.Name + " shares would run you $" + purchasePrice + " to buy, and you only have $" + session.dialogData.cash + " to spend!");
            }
        }
    }
])

//TODO: Combine sellStock and buyStock dialogs into one that receives a parameter for buy/sell and forks logic internally
bot.dialog('sellStock', [
    (session) => {
        builder.Prompts.text(session, "What stock (ticker symbol) would you like to sell?");
    },
    (session, results) => {
        var ticker = results.response;
        getStockInfo(ticker, (stockInfo, error) => {
            if (stockInfo && stockInfo.LastPrice && stockInfo.Name && !error) {
                session.dialogData.currentStockInfo = stockInfo;
                builder.Prompts.number(session, "The current price of " + stockInfo.Name + " is " + stockInfo.LastPrice + ". How much ya lookin' to sell?")
            } else {
                session.endDialog("Hmm I'm not sure that's a real ticker symbol. Either I'm broken or that's not an actual ticker symbol...")
            }
        })
    },
    (session, results) => {
        var stockQuantity = results.response;
        if (stockQuantity > 0) {
            //TODO: Resolve potential vulnerability - we should re-call the price API before we make purchases. 
            var sellPrice = stockQuantity * session.dialogData.currentStockInfo.LastPrice;
            if (removeStocks(session, session.dialogData.currentStockInfo.Symbol, stockQuantity)) {
                session.privateConversationData.cash += sellPrice;
                session.endDialog("Congrats! You just sold " + stockQuantity + " units of " + session.dialogData.currentStockInfo.Name + " stock. You've got $" + session.privateConversationData.cash + " now.")
            } else {
                session.endDialog("Couldn't sell that many of that stock. Don't think you've got that amount of that stock to sell...");
            }
        }
    }
])

bot.dialog('checkStocks', [
])

bot.dialog('lookupStock', [
])

let addStocks = (session, quantity) => {
    if (!session.privateConversationData.stocks) {
        session.privateConversationData.stocks = [];
    }
    if (hasStock(session)) {
        var stockIndex = getStockIndex(session.dialogData.currentStockInfo.Symbol);
        session.privateConversationData.stocks[i].quantity += quantity;
    } else {
        session.privateConversationData.stocks.push({ name: session.dialogData.currentStockInfo.Symbol, quantity: quantity });
    }
}

let getQuantityOfStock = (session, ticker) => {
    session.privateConversationData.stocks.forEach((stock, i) => {
        if (session.privateConversationData.stocks[i].ticker === ticker) {
            if (session.privateConversationData.stocks[i].quantity)
                return session.privateConversationData.stocks[i].quantity;
            return -1;
        }
    })
}

let removeStocks = (session, ticker, quantity) => {
    //Probably want more granularity in response. Right now we return false for both non-existent stocks and for exceeded quantity sold
    var index = getStockIndex(session, ticker);
    if (index > -1) {
        if (quantity < session.privateConversationData.stocks[i].quantity) {
            session.privateConversationData.stocks[i].quantity -= quantity;
        } else if (quantity === session.privateConversationData.stocks[i].quantity) {
            //Deletes stock object
            session.privateConversationData.stocks.splice(index, 1);
        } else {
            return false;
        }
    } else {
        return false;
    }
    return true;
}

let getStockIndex = (session, ticker) => {
    session.privateConversationData.stocks.forEach((stock, i) => {
        if (session.privateConversationData.stocks[i].name === ticker) {
            return i;
        }
        if (i === session.privateConversationData.stocks.length - 1)
            return false;
    })
}

let hasStock = (session, ticker) => {
    session.privateConversationData.stocks.forEach((stock, i) => {
        if (session.privateConversationData.stocks[i].name === ticker) {
            return true;
        }
        if (i === session.privateConversationData.stocks.length - 1)
            return false;
    })
}

let getStockInfo = (ticker, callback) => {
    request('http://dev.markitondemand.com/MODApis/Api/v2/Quote/jsonp?symbol=' + ticker, (error, response, body) => {
        if (!error && response.statusCode == 200) {
            //Some hacky parsing. Should probably use a real API :)
            callback(JSON.parse(body.substring(18, body.length - 1)), null);
        } else {
            callback(null, error);
        }
    })
}

let isPurchasable = (session, purchasePrice) => {
    return (purchasePrice <= session.privateConversationData.cash);
}