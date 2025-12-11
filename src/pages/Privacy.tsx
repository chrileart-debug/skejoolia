import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Logo */}
        <div className="flex items-center justify-center font-extrabold tracking-tighter select-none text-3xl md:text-4xl mb-8 text-foreground">
          <span>S</span>
          <span>K</span>
          <span>E</span>
          <span>J</span>
          <span className="text-primary inline-flex items-center justify-center mx-[2px] hover:rotate-180 transition-transform duration-700 ease-in-out">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 6v6l4 2"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
          </span>
          <span>O</span>
          <span>L</span>
        </div>

        <div className="flex items-center justify-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Política de Privacidade</h1>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <p className="text-muted-foreground text-lg">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-4">1. Introdução</h2>
            <p className="text-muted-foreground">
              A SKEJOOL está comprometida em proteger sua privacidade. Esta política descreve como 
              coletamos, usamos e protegemos suas informações pessoais quando você utiliza nossa 
              plataforma de gestão e agendamento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Dados que Coletamos</h2>
            <p className="text-muted-foreground mb-3">Coletamos os seguintes tipos de informações:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Dados de cadastro:</strong> nome, email, telefone, nome da empresa, CNPJ</li>
              <li><strong>Dados de uso:</strong> agendamentos, serviços cadastrados, clientes atendidos</li>
              <li><strong>Dados de integração:</strong> informações do WhatsApp Business conectado</li>
              <li><strong>Dados de pagamento:</strong> informações necessárias para processar assinaturas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Como Usamos seus Dados</h2>
            <p className="text-muted-foreground mb-3">Utilizamos suas informações para:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Fornecer e melhorar nossos serviços</li>
              <li>Processar agendamentos e gerenciar sua conta</li>
              <li>Enviar notificações importantes sobre o serviço</li>
              <li>Processar pagamentos e faturamento</li>
              <li>Fornecer suporte ao cliente</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground">
              Não vendemos suas informações pessoais. Compartilhamos dados apenas com:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
              <li><strong>Processadores de pagamento:</strong> para processar transações</li>
              <li><strong>Provedores de infraestrutura:</strong> para hospedar e manter o serviço</li>
              <li><strong>Autoridades legais:</strong> quando exigido por lei</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Segurança dos Dados</h2>
            <p className="text-muted-foreground">
              Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados, 
              incluindo criptografia em trânsito e em repouso, controles de acesso rigorosos e 
              monitoramento contínuo de segurança.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Seus Direitos</h2>
            <p className="text-muted-foreground mb-3">Você tem direito a:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incorretos</li>
              <li>Solicitar exclusão de seus dados</li>
              <li>Exportar seus dados</li>
              <li>Revogar consentimento a qualquer momento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Retenção de Dados</h2>
            <p className="text-muted-foreground">
              Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento, os dados 
              são retidos por até 5 anos para fins legais e fiscais, após os quais são excluídos 
              permanentemente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Contato</h2>
            <p className="text-muted-foreground">
              Para questões sobre privacidade, entre em contato pelo email:{" "}
              <a href="mailto:suporte@app.skejool.com.br" className="text-primary hover:underline">
                suporte@app.skejool.com.br
              </a>
            </p>
          </section>
        </div>

        {/* Back Link */}
        <div className="mt-12 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
