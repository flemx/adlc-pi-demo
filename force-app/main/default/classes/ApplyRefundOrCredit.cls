/**
 * Stub action for the Pronto Order Support agent.
 * Calculates a refund/credit per policy and "applies" it; no DML.
 */
public with sharing class ApplyRefundOrCredit {

    public class Request {
        @InvocableVariable(required=true label='Case Id'        description='The case driving the refund')
        public String caseId;

        @InvocableVariable(required=true label='Customer Email' description='Email to confirm the refund to')
        public String customerEmail;

        @InvocableVariable(label='Reason'      description='missing_items | sla_delay | wrong_address | goodwill')
        public String reason;
    }

    public class Response {
        @InvocableVariable(label='Outcome')           public String outcome;
        @InvocableVariable(label='Credit Amount USD') public Decimal creditAmountUsd;
        @InvocableVariable(label='Reference Id')      public String referenceId;
        @InvocableVariable(label='Reason Applied')    public String reasonApplied;
        @InvocableVariable(label='Customer Message')  public String customerMessage;
    }

    @InvocableMethod(
        label='Apply Refund Or Credit'
        description='Compute and apply a refund or goodwill credit per Pronto policy. Stub — returns hard-coded data.'
        category='Pronto Order Support'
    )
    public static List<Response> apply(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response res = new Response();
            String reason = String.isBlank(r.reason) ? 'missing_items' : r.reason.toLowerCase();
            Decimal amount;
            if (reason == 'sla_delay')         amount = 4.50;
            else if (reason == 'wrong_address') amount = 12.00;
            else if (reason == 'goodwill')      amount = 5.00;
            else                                amount = 8.75; // missing_items default

            res.outcome          = 'applied';
            res.creditAmountUsd  = amount;
            String rnd = String.valueOf(Math.abs(Crypto.getRandomInteger())).leftPad(8, '0');
            res.referenceId      = 'CR-' + rnd.substring(rnd.length() - 8);
            res.reasonApplied    = reason;
            res.customerMessage  = 'A credit of $' + amount + ' has been applied to the account on file. A confirmation email has been sent to ' + r.customerEmail + '.';
            out.add(res);
        }
        return out;
    }
}
