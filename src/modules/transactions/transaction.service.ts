import { QueryRunner } from 'typeorm';
import { CustomerEntity, AccountEntity } from '../customers/customer.entity';
import { TransactionExchangeRateEntity } from './entity/exchange_rate/exchange.rate.entity';
import { ICreateTransactionDto, ICreateExchangeRate } from './transactions.dto';
import { TransactionEntity } from './entity/transaction.entity';
import { TransactionType } from './types/transactions.types';
import { CurrencyEntity } from '../currency/currency.entity';

export abstract class ITransactionService {
  async makeTransaction(
    queryRunner: QueryRunner,
    body: any,
    customer: CustomerEntity,
    fromAccount: AccountEntity,
    type: TransactionType,
    toCurrency: CurrencyEntity
  ): Promise<[QueryRunner, TransactionEntity, ICreateTransactionDto]> {
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      /// get Dto from Body
      const dto = this.getTransactionDto(
        body,
        customer,
        fromAccount,
        toCurrency
      );
      // get ExhangeRate Entity to be saved
      const exchangeRate = this.getExchangeRateEntityFromDto(
        dto.exchangeRate,
        dto.amount
      );
      // save ExchangRateEntity
      await queryRunner.manager.save<TransactionExchangeRateEntity>(
        exchangeRate
      );
      // get TransactionEntity from dto
      const transactionEntity = this.getTransactionEntityFromDto(dto);
      /// assign to exhcangeRate to it
      transactionEntity.exchangeRate = exchangeRate;
      transactionEntity.type = type;
      // save Transaction entity
      await queryRunner.manager.save<TransactionEntity>(transactionEntity);
      return [queryRunner, transactionEntity, dto];
    } catch (e) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      console.error(e);
      throw Error('Unable to create customer');
    }
  }

  getTransactionDto(
    body: any,
    customer: CustomerEntity,
    fromAccount: AccountEntity,
    toCurrency: CurrencyEntity
  ): ICreateTransactionDto {
    return {
      amount: Math.abs(body['amount']),
      customer: customer,
      fromAccount: fromAccount,
      balanceSnapshot: fromAccount.balance,

      exchangeRate: {
        fromCurrency: fromAccount.currency,
        toCurrency: toCurrency,
        rate: toCurrency.id == fromAccount.currency.id ? 1 : body['rate'],
      },
    };
  }
  getExchangeRateEntityFromDto(
    dto: ICreateExchangeRate,
    amount: number
  ): TransactionExchangeRateEntity {
    const entity = new TransactionExchangeRateEntity();
    entity.fromCurrency = dto.fromCurrency;
    entity.toCurrency = dto.toCurrency;
    entity.rate = dto.rate;
    entity.exhangedAmount = amount * dto.rate;
    return entity;
  }

  getTransactionEntityFromDto(dto: ICreateTransactionDto): TransactionEntity {
    const transactionEntity = new TransactionEntity();
    transactionEntity.amount = dto.amount;
    transactionEntity.balanceSnapShot = dto.fromAccount.balance;
    transactionEntity.customer = dto.customer;
    transactionEntity.fromAccount = dto.fromAccount;
    transactionEntity.fromAccount.customerId = dto.customer.id;

    transactionEntity.comment = dto.comment ?? 'N/A';
    return transactionEntity;
  }

  getAccountEntityFromDto(
    customer: CustomerEntity,
    fromAccount: AccountEntity
  ): AccountEntity {
    const updatedFromAccount = new AccountEntity();
    updatedFromAccount.id = fromAccount.id;
    updatedFromAccount.customerId = customer.id;
    updatedFromAccount.currencyId = fromAccount.currency.id;
    return updatedFromAccount;
  }
}