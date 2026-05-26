public with sharing class ApplyRefundOrCredit {

    public class Request {
        @InvocableVariable(required=true label='Case Id')
        public String caseId;

        @InvocableVariable(required=true label='Customer Email')
        public String customerEmail;

        @InvocableVariable(required=true label='Reason')
        public String reason;
    }

    public class Response {
        @InvocableVariable(label='Reference Id')
        public String referenceId;

        @InvocableVariable(label='Credit Amount Usd')
        public Decimal creditAmountUsd;

        @InvocableVariable(label='Confirmation Sent To')
        public String confirmationSentTo;
    }

    @InvocableMethod(
        label='Apply Refund Or Credit'
        description='Applies the refund or goodwill credit recommended by Get Order Status.'
        category='Pronto Order Support'
    )
    public static List<Response> apply(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response res = new Response();
            res.referenceId        = 'CR-12345678';
            res.creditAmountUsd    = 14.20;
            res.confirmationSentTo = String.isBlank(r.customerEmail)
                ? 'alex@example.com'
                : r.customerEmail;
            out.add(res);
        }
        return out;
    }
}
