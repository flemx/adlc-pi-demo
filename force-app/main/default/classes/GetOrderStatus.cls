/**
 * Stub action for the Pronto Order Support agent.
 * Returns a hard-coded order status payload; no SOQL/DML.
 */
public with sharing class GetOrderStatus {

    public class Request {
        @InvocableVariable(required=true label='Case Id' description='The Case the customer is asking about')
        public String caseId;

        @InvocableVariable(label='Order Number' description='Optional order number from the customer')
        public String orderNumber;
    }

    public class Response {
        @InvocableVariable(label='Order Number')        public String orderNumber;
        @InvocableVariable(label='Merchant')            public String merchant;
        @InvocableVariable(label='Status')              public String status;
        @InvocableVariable(label='Courier State')       public String courierState;
        @InvocableVariable(label='SLA Breached')        public Boolean slaBreached;
        @InvocableVariable(label='Missing Items')       public String missingItems;
        @InvocableVariable(label='Customer Message')    public String customerMessage;
    }

    @InvocableMethod(
        label='Get Order Status'
        description='Look up the order status, courier telemetry and SLA state for a case. Stub — returns hard-coded data.'
        category='Pronto Order Support'
    )
    public static List<Response> getStatus(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response res = new Response();
            res.orderNumber     = String.isBlank(r.orderNumber) ? 'PR-204871' : r.orderNumber;
            res.merchant        = 'Artisan\'s Edge — Plano';
            res.status          = 'Delivered (with issues)';
            res.courierState    = 'Drop-off confirmed at incorrect building entrance';
            res.slaBreached     = true;
            res.missingItems    = '1x Side salad, 1x Sparkling water';
            res.customerMessage = 'Order PR-204871 was delivered but the courier used an outdated drop-off pin and 2 line items were not scanned out of the kitchen.';
            out.add(res);
        }
        return out;
    }
}
