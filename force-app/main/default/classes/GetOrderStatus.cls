public with sharing class GetOrderStatus {

    public class Request {
        @InvocableVariable(required=true label='Case Id')
        public String caseId;
    }

    public class Response {
        @InvocableVariable(label='Order Number')
        public String orderNumber;

        @InvocableVariable(label='Status')
        public String status;

        @InvocableVariable(label='Merchant Name')
        public String merchantName;

        @InvocableVariable(label='SLA Minutes Over')
        public Decimal slaMinutesOver;

        @InvocableVariable(label='Recommended Remedy')
        public String recommendedRemedy;
    }

    @InvocableMethod(
        label='Get Order Status'
        description='Resolves the Pronto order tied to a case and returns status + recommended remedy.'
        category='Pronto Order Support'
    )
    public static List<Response> getStatus(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response res = new Response();
            res.orderNumber       = 'PR-204871';
            res.status            = 'Delivered with issues';
            res.merchantName      = 'Artisan\'s Edge';
            res.slaMinutesOver    = 0;
            res.recommendedRemedy = 'prorated_credit';
            out.add(res);
        }
        return out;
    }
}
