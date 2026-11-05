/////   COST OF DATA TRANSFER
var data_transfer_time = 1;

function get_data_transfer_time(source, receiver) {
    if (parseInt(source) == parseInt(receiver))
        return 0;
    return data_transfer_time;
}

function get_average_data_transfer_time() {
    return data_transfer_time;
}

/////   NODES INFO
function get_nodes_info(nodes_count){
    var processors = [];
    for (var i = 0; i < nodes_count; i++){
        processors.push({name: i, release_time: 0});
    }
    return processors;
}

module.exports = {
	get_data_transfer_time, get_average_data_transfer_time , get_nodes_info
}

